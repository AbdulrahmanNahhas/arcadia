// The only unsafe declaration is the CXX ABI. CXX owns object lifetimes and
// converts std::exception to Result; no raw pointers enter the public Rust API.
#[cxx::bridge(namespace = "nahhasio")]
pub(crate) mod ffi {
    struct File {
        index: u32,
        path: String,
        size: u64,
        pad: bool,
    }
    struct Identity {
        v1: String,
        v2: String,
    }
    struct Status {
        verified: u64,
        total: u64,
        paused: bool,
        complete: bool,
        error: String,
        metadata: bool,
        checking: bool,
    }
    unsafe extern "C++" {
        include!("native/engine.h");
        type Session;
        fn session(public_network: bool) -> Result<UniquePtr<Session>>;
        fn inspect(data: &[u8], magnet: &str) -> Result<Identity>;
        fn describe(data: &[u8], magnet: &str, resume: &[u8]) -> Result<Vec<File>>;
        fn resume_identity(data: &[u8]) -> Result<Identity>;
        fn add(
            self: Pin<&mut Session>,
            id: &str,
            data: &[u8],
            magnet: &str,
            root: &str,
            resume: &[u8],
        ) -> Result<()>;
        fn files(self: &Session, id: &str) -> Result<Vec<File>>;
        fn select(self: Pin<&mut Session>, id: &str, indices: &[u32]) -> Result<()>;
        fn start(self: Pin<&mut Session>, id: &str) -> Result<()>;
        fn pause(self: Pin<&mut Session>, id: &str) -> Result<()>;
        fn status(self: &Session, id: &str) -> Result<Status>;
        fn piece(self: Pin<&mut Session>, id: &str, file: u32, offset: u64) -> Result<Vec<u8>>;
        fn begin_read(
            self: Pin<&mut Session>,
            id: &str,
            file: u32,
            offset: u64,
            length: u32,
        ) -> Result<u64>;
        fn end_read(self: Pin<&mut Session>, token: u64) -> Result<()>;
        fn upgrade(self: Pin<&mut Session>, id: &str, data: &[u8]) -> Result<()>;
        fn save(self: Pin<&mut Session>, id: &str) -> Result<Vec<u8>>;
        fn connect_peer(self: Pin<&mut Session>, id: &str, port: u16) -> Result<()>;
        fn listen_port(self: &Session) -> Result<u16>;
        #[allow(dead_code)]
        fn fixture(root: &str, version: u8) -> Result<Vec<u8>>;
    }
}
