/// Common types shared between the server and webassembly modules.
use serde::{Deserialize, Serialize};

/// Parameters for key generation and signing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameters {
    pub parties: u16,
    pub threshold: u16,
}

impl Default for Parameters {
    fn default() -> Self {
        return Self {
            parties: 3,
            threshold: 1,
        };
    }
}
