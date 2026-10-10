#pragma once
#include "rust/cxx.h"
#include <memory>
#include <string>
#include <libtorrent/session.hpp>
#include <libtorrent/torrent_handle.hpp>
#include <map>
#include <set>
namespace nahhasio {
struct Identity;
struct File;
struct Status;
class Session {
    libtorrent::session engine;
    std::map<std::string, libtorrent::torrent_handle> handles;
    std::map<std::string, std::vector<libtorrent::announce_entry>> trackers;
    std::map<std::string, std::vector<uint32_t>> selections;
    std::map<uint64_t, std::pair<std::string, std::vector<int>>> readers;
    std::map<std::pair<std::string, int>, int> deadlines;
    uint64_t next_read = 1;
    std::set<std::string> pending_saves;
    std::map<std::string, std::vector<char>> saved_resume;
    std::map<std::string, std::string> save_errors;
    void capture_resume(libtorrent::alert const*);
    bool public_network;
    libtorrent::torrent_handle get(rust::Str id) const;
public:
    explicit Session(bool);
    void add(rust::Str, rust::Slice<const uint8_t>, rust::Str, rust::Str, rust::Slice<const uint8_t>);
    rust::Vec<File> files(rust::Str) const;
    void select(rust::Str, rust::Slice<const uint32_t>);
    void start(rust::Str);
    void pause(rust::Str);
    Status status(rust::Str) const;
    rust::Vec<uint8_t> piece(rust::Str, uint32_t, uint64_t);
    uint64_t begin_read(rust::Str, uint32_t, uint64_t, uint32_t);
    void end_read(uint64_t);
    void upgrade(rust::Str, rust::Slice<const uint8_t>);
    rust::Vec<uint8_t> save(rust::Str);
    void connect_peer(rust::Str, uint16_t);
    uint16_t listen_port() const;
};
std::unique_ptr<Session> session(bool);
Identity inspect(rust::Slice<const uint8_t>, rust::Str);
rust::Vec<File> describe(rust::Slice<const uint8_t>, rust::Str, rust::Slice<const uint8_t>);
Identity resume_identity(rust::Slice<const uint8_t>);
rust::Vec<uint8_t> fixture(rust::Str, uint8_t);
}
