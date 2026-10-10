fn main() {
    let lib = pkg_config::Config::new()
        .atleast_version("2.0.12")
        .probe("libtorrent-rasterbar")
        .expect("libtorrent-rasterbar 2.0.12 development files are required");
    let mut build = cxx_build::bridge("src/bridge.rs");
    build
        .file("native/engine.cc")
        .include(".")
        .std("c++17")
        .opt_level(1);
    for path in lib.include_paths {
        build.include(path);
    }
    for (name, value) in lib.defines {
        build.define(&name, value.as_deref());
    }
    build.compile("media-transfer-native");
    println!("cargo:rerun-if-changed=src/bridge.rs");
    println!("cargo:rerun-if-changed=native/engine.h");
    println!("cargo:rerun-if-changed=native/engine.cc");
}
