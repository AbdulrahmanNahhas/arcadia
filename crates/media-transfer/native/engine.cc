#include "media-transfer/src/bridge.rs.h"
#include <libtorrent/alert_types.hpp>
#include <libtorrent/magnet_uri.hpp>
#include <libtorrent/torrent_info.hpp>
#include <libtorrent/read_resume_data.hpp>
#include <libtorrent/write_resume_data.hpp>
#include <libtorrent/settings_pack.hpp>
#include <libtorrent/hex.hpp>
#include <libtorrent/bdecode.hpp>
#include <libtorrent/create_torrent.hpp>
#include <libtorrent/bencode.hpp>
#include <libtorrent/ip_filter.hpp>
#include <thread>
#include <chrono>
#include <set>
#include <filesystem>
namespace nahhasio {
namespace lt = libtorrent;
static void component(lt::string_view text) {
    if (text.empty() || text == "." || text == ".." || text.size() > 255)
        throw std::runtime_error("unsafe filename component");
    for (char c: text) if (c == '/' || c == '\\' || c == ':' || c == '\0')
        throw std::runtime_error("unsafe filename component");
}
static void tree(lt::bdecode_node node, int depth) {
    if (depth > 64 || node.type() != lt::bdecode_node::dict_t)
        throw std::runtime_error("invalid file tree");
    for (int i = 0; i < node.dict_size(); ++i) {
        auto item = node.dict_at(i);
        if (item.first.empty()) {
            auto attr = item.second.dict_find_string_value("attr");
            if (attr.find('l') != lt::string_view::npos)
                throw std::runtime_error("symlink metainfo");
        } else { component(item.first); tree(item.second, depth + 1); }
    }
}
static void validate_info(lt::bdecode_node info) {
    component(info.dict_find_string_value("name"));
    auto utf8_name = info.dict_find_string("name.utf-8");
    if (utf8_name) component(utf8_name.string_value());
    auto files = info.dict_find_list("files");
    if (files && files.list_size() > 10000) throw std::runtime_error("too many files");
    if (info.dict_find_string_value("attr").find('l') != lt::string_view::npos)
        throw std::runtime_error("symlink metainfo");
    for (int i = 0; files && i < files.list_size(); ++i) {
        auto file = files.list_at(i);
        if (file.dict_find_string_value("attr").find('l') != lt::string_view::npos)
            throw std::runtime_error("symlink metainfo");
        auto path = file.dict_find_list("path");
        if (!path || path.list_size() == 0 || path.list_size() > 64) throw std::runtime_error("invalid file path");
        for (int n = 0; n < path.list_size(); ++n) component(path.list_string_value_at(n));
        auto utf8_path = file.dict_find_list("path.utf-8");
        for (int n = 0; utf8_path && n < utf8_path.list_size(); ++n) component(utf8_path.list_string_value_at(n));
    }
    auto file_tree = info.dict_find_dict("file tree");
    if (file_tree) tree(file_tree, 0);
}
static void validate_metainfo(rust::Slice<const uint8_t> data) {
    if (data.empty() || data.size() > 8*1024*1024) throw std::runtime_error("metainfo size");
    lt::error_code error;
    auto node = lt::bdecode(lt::span<char const>(reinterpret_cast<char const*>(data.data()), data.size()), error, nullptr, 100, 200000);
    if (error) throw std::runtime_error(error.message());
    validate_info(node.dict_find_dict("info"));
}
static void validate_ti(lt::torrent_info const& ti) {
    if (ti.num_files() > 10000 || ti.piece_length() > 16*1024*1024 || ti.num_pieces() > 1000000)
        throw std::runtime_error("metadata resource limits");
    auto section = ti.info_section();
    if (section.size() > 8*1024*1024) throw std::runtime_error("metadata size");
    lt::error_code error;
    auto info = lt::bdecode(section, error, nullptr, 100, 200000);
    if (error) throw std::runtime_error(error.message());
    validate_info(info);
    std::set<std::string> paths;
    for (auto index: ti.files().file_range()) {
        if (ti.files().file_flags(index) & lt::file_storage::flag_symlink)
            throw std::runtime_error("symlinks are not permitted");
        if (!paths.insert(ti.files().file_path(index)).second)
            throw std::runtime_error("duplicate normalized file paths");
    }
}
static lt::add_torrent_params parse(rust::Slice<const uint8_t> data, rust::Str magnet) {
    lt::add_torrent_params p;
    if (!magnet.empty()) p = lt::parse_magnet_uri(std::string(magnet));
    else {
        validate_metainfo(data);
        p.ti = std::make_shared<lt::torrent_info>(reinterpret_cast<char const*>(data.data()), int(data.size()));
        if (p.ti->piece_length() > 16*1024*1024 || p.ti->num_pieces() > 1000000)
            throw std::runtime_error("piece resource limits");
    }
    return p;
}
Identity inspect(rust::Slice<const uint8_t> data, rust::Str magnet) {
    auto p = parse(data, magnet);
    auto h = p.ti ? p.ti->info_hashes() : p.info_hashes;
    Identity result;
    if (h.has_v1()) result.v1 = lt::aux::to_hex(h.v1);
    if (h.has_v2()) result.v2 = lt::aux::to_hex(h.v2);
    if (!h.has_v1() && !h.has_v2()) throw std::runtime_error("missing torrent identity");
    return result;
}
static lt::settings_pack settings() {
    lt::settings_pack p;
    p.set_bool(lt::settings_pack::enable_dht, false);
    p.set_bool(lt::settings_pack::enable_lsd, false);
    p.set_bool(lt::settings_pack::enable_upnp, false);
    p.set_bool(lt::settings_pack::enable_natpmp, false);
    p.set_str(lt::settings_pack::listen_interfaces, "127.0.0.1:0");
    p.set_int(lt::settings_pack::alert_mask, lt::alert_category::storage | lt::alert_category::status | lt::alert_category::error);
    p.set_int(lt::settings_pack::max_metadata_size, 8*1024*1024);
    p.set_int(lt::settings_pack::connections_limit, 128);
    return p;
}
Identity resume_identity(rust::Slice<const uint8_t> data) {
    auto p = lt::read_resume_data(lt::span<char const>(reinterpret_cast<char const*>(data.data()), data.size()));
    auto hashes = p.ti ? p.ti->info_hashes() : p.info_hashes;
    Identity identity;
    if (hashes.has_v1()) identity.v1 = lt::aux::to_hex(hashes.v1);
    if (hashes.has_v2()) identity.v2 = lt::aux::to_hex(hashes.v2);
    return identity;
}
static lt::ip_filter loopback_filter() {
    lt::ip_filter filter;
    filter.add_rule(lt::make_address("0.0.0.0"), lt::make_address("255.255.255.255"), lt::ip_filter::blocked);
    filter.add_rule(lt::make_address("::"), lt::make_address("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"), lt::ip_filter::blocked);
    filter.add_rule(lt::make_address("127.0.0.1"), lt::make_address("127.0.0.1"), 0);
    filter.add_rule(lt::make_address("::1"), lt::make_address("::1"), 0);
    return filter;
}
Session::Session(bool network): engine(settings()), public_network(network) {
    engine.pause(); engine.set_ip_filter(loopback_filter());
}
std::unique_ptr<Session> session(bool network) { return std::make_unique<Session>(network); }
lt::torrent_handle Session::get(rust::Str id) const {
    auto i = handles.find(std::string(id));
    if (i == handles.end()) throw std::runtime_error("unknown transfer");
    return i->second;
}
void Session::add(rust::Str id, rust::Slice<const uint8_t> data, rust::Str magnet, rust::Str root, rust::Slice<const uint8_t> resume) {
    auto source = parse(data, magnet);
    std::vector<lt::announce_entry> entries;
    for (auto const& url: source.trackers) entries.emplace_back(url);
    if (source.ti) {
        entries = source.ti->trackers();
        if (source.ti->num_files() > 10000) throw std::runtime_error("too many files");
        for (auto index: source.ti->files().file_range()) {
            if (source.ti->files().file_flags(index) & lt::file_storage::flag_symlink)
                throw std::runtime_error("symlinks are not permitted");
        }
    }
    auto p = resume.empty() ? source : lt::read_resume_data(lt::span<char const>(reinterpret_cast<char const*>(resume.data()), resume.size()));
    // A forced recheck queued during initial resume checking can be ignored by
    // libtorrent. Strip the trusted bitfields BEFORE add instead, so every
    // restoration enters ordinary storage hashing rather than fast-resume.
    p.have_pieces.clear();
    p.verified_pieces.clear();
    p.unfinished_pieces.clear();
    p.renamed_files.clear();
    p.flags &= ~lt::torrent_flags::seed_mode;
    if (source.ti) p.ti = source.ti;
    p.info_hashes = source.ti ? source.ti->info_hashes() : source.info_hashes;
    if (p.ti) {
        validate_ti(*p.ti);
        auto hashes = p.ti->info_hashes();
        if ((p.info_hashes.has_v1() && p.info_hashes.v1 != hashes.v1)
            || (p.info_hashes.has_v2() && p.info_hashes.v2 != hashes.v2))
            throw std::runtime_error("resume identity mismatch");
    }
    p.save_path = std::string(root);
    p.flags |= lt::torrent_flags::paused;
    p.flags &= ~lt::torrent_flags::auto_managed;
    p.flags |= lt::torrent_flags::duplicate_is_error;
    // Magnets may obtain metadata, but cannot write payload before validated
    // file selection. No downloaded resume priorities may bypass this barrier.
    p.flags |= lt::torrent_flags::upload_mode;
    // Trackers are retained separately and only installed at explicit start.
    p.trackers.clear(); p.url_seeds.clear(); p.http_seeds.clear();
    p.dht_nodes.clear();
    p.flags |= lt::torrent_flags::override_trackers | lt::torrent_flags::override_web_seeds;
    p.flags |= lt::torrent_flags::disable_dht | lt::torrent_flags::disable_lsd | lt::torrent_flags::disable_pex;
    if (p.ti) p.file_priorities.assign(p.ti->num_files(), lt::dont_download);
    auto h = engine.add_torrent(p);
    handles.emplace(std::string(id), h);
    trackers.emplace(std::string(id), std::move(entries));
    // Never trust clean-shutdown claims after process death.
    h.force_recheck();
}
static rust::Vec<File> describe_ti(std::shared_ptr<lt::torrent_info const> ti) {
    if (!ti) throw std::runtime_error("metadata pending");
    validate_ti(*ti);
    rust::Vec<File> result;
    for (auto i: ti->files().file_range()) {
        File f;
        f.index = uint32_t(int(i)); f.path = ti->files().file_path(i);
        f.size = uint64_t(ti->files().file_size(i));
        f.pad = bool(ti->files().file_flags(i) & lt::file_storage::flag_pad_file);
        if (ti->files().file_flags(i) & lt::file_storage::flag_symlink)
            throw std::runtime_error("symlinks are not permitted");
        result.push_back(std::move(f));
    }
    return result;
}
rust::Vec<File> Session::files(rust::Str id) const {
    return describe_ti(get(id).torrent_file());
}
rust::Vec<File> describe(rust::Slice<const uint8_t> data, rust::Str magnet, rust::Slice<const uint8_t> resume) {
    auto source = parse(data, magnet);
    if (source.ti) return describe_ti(source.ti);
    if (!resume.empty()) {
        auto p = lt::read_resume_data(lt::span<char const>(reinterpret_cast<char const*>(resume.data()), resume.size()));
        if (p.ti) return describe_ti(p.ti);
    }
    return {};
}
void Session::select(rust::Str id, rust::Slice<const uint32_t> indices) {
    auto h = get(id); auto ti = h.torrent_file();
    if (!ti) throw std::runtime_error("metadata pending");
    std::vector<lt::download_priority_t> priorities(ti->num_files(), lt::dont_download);
    for (auto i: indices) {
        if (i >= priorities.size()) throw std::runtime_error("invalid file");
        priorities[i] = lt::default_priority;
    }
    h.prioritize_files(priorities);
    selections[std::string(id)] = std::vector<uint32_t>(indices.begin(), indices.end());
    if (!indices.empty()) h.unset_flags(lt::torrent_flags::upload_mode);
    else h.set_flags(lt::torrent_flags::upload_mode);
}
void Session::start(rust::Str id) {
    auto h = get(id);
    if (public_network) {
        lt::settings_pack p;
        p.set_str(lt::settings_pack::listen_interfaces, "0.0.0.0:0,[::]:0");
        p.set_bool(lt::settings_pack::enable_dht, true);
        engine.apply_settings(p);
        engine.set_ip_filter(lt::ip_filter{});
        h.unset_flags(lt::torrent_flags::disable_dht | lt::torrent_flags::disable_pex);
        h.replace_trackers(trackers.at(std::string(id)));
    }
    engine.resume(); h.resume();
}
void Session::pause(rust::Str id) {
    get(id).pause();
    bool any_running = false;
    for (auto const& item: handles)
        if (!(item.second.status().flags & lt::torrent_flags::paused)) any_running = true;
    if (!any_running) {
        engine.pause();
        lt::settings_pack p; p.set_bool(lt::settings_pack::enable_dht, false);
        p.set_str(lt::settings_pack::listen_interfaces, "127.0.0.1:0");
        engine.apply_settings(p); engine.set_ip_filter(loopback_filter());
    }
}
Status Session::status(rust::Str id) const {
    auto h = get(id);
    auto s = h.status();
    Status r; r.verified = 0; r.total = 0; r.complete = false;
    auto ti = h.torrent_file();
    r.metadata = bool(ti);
    r.checking = s.state == lt::torrent_status::checking_files || s.state == lt::torrent_status::checking_resume_data;
    auto selected = selections.find(std::string(id));
    if (ti && selected != selections.end() && !selected->second.empty()) {
        auto progress = h.file_progress(lt::torrent_handle::piece_granularity);
        for (auto index: selected->second) {
            r.total += ti->files().file_size(lt::file_index_t(int(index)));
            r.verified += progress.at(index);
        }
        r.complete = r.verified == r.total
            && s.state != lt::torrent_status::checking_files
            && s.state != lt::torrent_status::checking_resume_data;
    }
    r.paused = bool(s.flags & lt::torrent_flags::paused);
    r.error = s.errc ? s.errc.message() : "";
    return r;
}
rust::Vec<uint8_t> Session::piece(rust::Str id, uint32_t file, uint64_t offset) {
    auto h = get(id); auto ti = h.torrent_file();
    if (!ti || file >= uint32_t(ti->num_files())) throw std::runtime_error("invalid file");
    auto index = lt::file_index_t(int(file));
    if (offset >= uint64_t(ti->files().file_size(index))) throw std::runtime_error("invalid offset");
    auto absolute = ti->files().file_offset(index) + int64_t(offset);
    auto pi = lt::piece_index_t(int(absolute / ti->piece_length()));
    rust::Vec<uint8_t> result;
    auto state = h.status().state;
    if (state == lt::torrent_status::checking_files || state == lt::torrent_status::checking_resume_data)
        return result;
    if (!h.have_piece(pi)) return result;
    // read_piece uses libtorrent storage and only returns verified pieces.
    h.read_piece(pi);
    auto until = std::chrono::steady_clock::now() + std::chrono::milliseconds(200);
    while (std::chrono::steady_clock::now() < until) {
        engine.wait_for_alert(std::chrono::milliseconds(20));
        std::vector<lt::alert*> alerts; engine.pop_alerts(&alerts);
        for (auto alert: alerts) capture_resume(alert);
        for (auto a: alerts) if (auto read = lt::alert_cast<lt::read_piece_alert>(a)) {
            if (read->handle != h || read->piece != pi) continue;
            if (read->error) throw std::runtime_error(read->error.message());
            auto begin = int(absolute % ti->piece_length());
            auto count = std::min<int64_t>(256*1024, std::min<int64_t>(read->size - begin, ti->files().file_size(index) - int64_t(offset)));
            for (int64_t n = 0; n < count; ++n) result.push_back(uint8_t(read->buffer[begin+n]));
            return result;
        }
    }
    return result;
}
uint64_t Session::begin_read(rust::Str id, uint32_t file, uint64_t offset, uint32_t length) {
    if (readers.size() >= 8 || length > 256*1024) throw std::runtime_error("reader limit");
    auto h = get(id); auto ti = h.torrent_file();
    if (!ti || file >= uint32_t(ti->num_files())) throw std::runtime_error("invalid file");
    auto fi = lt::file_index_t(int(file));
    auto size = uint64_t(ti->files().file_size(fi));
    if (offset > size || length > size - offset) throw std::runtime_error("invalid range");
    auto token = next_read++;
    std::vector<int> pieces;
    if (length > 0) {
        auto begin = (ti->files().file_offset(fi) + int64_t(offset)) / ti->piece_length();
        auto end = (ti->files().file_offset(fi) + int64_t(offset) + length - 1) / ti->piece_length();
        for (auto i = begin; i <= end; ++i) {
            pieces.push_back(int(i));
            if (++deadlines[{std::string(id), int(i)}] == 1) h.set_piece_deadline(lt::piece_index_t(int(i)), 0);
        }
    }
    readers.emplace(token, std::make_pair(std::string(id), std::move(pieces)));
    return token;
}
void Session::end_read(uint64_t token) {
    auto read = readers.find(token);
    if (read == readers.end()) return;
    auto h = get(read->second.first);
    for (int pi: read->second.second) {
        auto item = deadlines.find({read->second.first, pi});
        if (item != deadlines.end() && --item->second == 0) {
            h.reset_piece_deadline(lt::piece_index_t(pi)); deadlines.erase(item);
        }
    }
    readers.erase(read);
}
void Session::upgrade(rust::Str id, rust::Slice<const uint8_t> data) {
    auto p = parse(data, rust::Str{});
    auto h = get(id);
    if (!h.torrent_file() && !h.set_metadata(p.ti->info_section()))
        throw std::runtime_error("metadata upgrade rejected");
    trackers[std::string(id)] = p.ti->trackers();
}
rust::Vec<uint8_t> Session::save(rust::Str id) {
    auto h = get(id);
    auto key = std::string(id);
    if (!pending_saves.count(key)) {
        if (pending_saves.size() >= 4) throw std::runtime_error("resume save admission limit");
        h.save_resume_data(lt::torrent_handle::flush_disk_cache | lt::torrent_handle::save_info_dict);
        pending_saves.insert(key);
    }
    auto until = std::chrono::steady_clock::now() + std::chrono::milliseconds(200);
    while (std::chrono::steady_clock::now() < until) {
        if (auto error = save_errors.find(key); error != save_errors.end()) {
            auto message = error->second;
            save_errors.erase(error); pending_saves.erase(key);
            throw std::runtime_error(message);
        }
        if (auto saved = saved_resume.find(key); saved != saved_resume.end()) {
            rust::Vec<uint8_t> result;
            for (char b: saved->second) result.push_back(uint8_t(b));
            saved_resume.erase(saved); pending_saves.erase(key);
            return result;
        }
        engine.wait_for_alert(std::chrono::milliseconds(20));
        std::vector<lt::alert*> alerts; engine.pop_alerts(&alerts);
        for (auto alert: alerts) capture_resume(alert);
    }
    return {};
}
void Session::capture_resume(lt::alert const* alert) {
    auto saved = lt::alert_cast<lt::save_resume_data_alert>(alert);
    auto failed = lt::alert_cast<lt::save_resume_data_failed_alert>(alert);
    if (!saved && !failed) return;
    auto handle = saved ? saved->handle : failed->handle;
    for (auto const& item: handles) if (item.second == handle && pending_saves.count(item.first)) {
        if (failed) save_errors[item.first] = failed->error.message();
        else {
            auto bytes = lt::write_resume_data_buf(saved->params);
            if (bytes.size() > 32*1024*1024) save_errors[item.first] = "resume data limit";
            else saved_resume[item.first] = std::move(bytes);
        }
        break;
    }
}
void Session::connect_peer(rust::Str id, uint16_t port) {
    get(id).connect_peer(lt::tcp::endpoint(lt::make_address("127.0.0.1"), port));
}
uint16_t Session::listen_port() const { return uint16_t(engine.listen_port()); }
rust::Vec<uint8_t> fixture(rust::Str root, uint8_t version) {
    lt::file_storage fs;
    fs.add_file("fixture/movie.mp4", std::filesystem::file_size(std::filesystem::path(std::string(root)) / "fixture/movie.mp4"));
    fs.add_file("fixture/readme.txt", 32);
    auto flags = version == 1 ? lt::create_torrent::v1_only : version == 2 ? lt::create_torrent::v2_only : lt::create_flags_t{};
    lt::create_torrent torrent(fs, 16384, flags);
    lt::set_piece_hashes(torrent, std::string(root));
    std::vector<char> bytes;
    lt::bencode(std::back_inserter(bytes), torrent.generate());
    rust::Vec<uint8_t> result;
    for (char b: bytes) result.push_back(uint8_t(b));
    return result;
}
}
