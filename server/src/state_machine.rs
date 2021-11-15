#[derive(Debug)]
pub(super) enum Phase {
    /// Waiting for the first client connection.
    Idle,
    /// Waiting for N parties to connect.
    Standby,
    /// Generating and distributing the keys.
    Keygen,
    /// Signing a message when N+1 threshold has been reached.
    Signing,
}

impl Default for Phase {
    fn default() -> Self {
        Phase::Idle
    }
}

#[derive(Debug)]
pub(super) struct PhaseIterator<'a> {
    pub(super) phases: &'a Vec<Phase>,
    pub(super) index: usize,
}

impl<'a> Iterator for PhaseIterator<'a> {
    type Item = &'a Phase;
    fn next(&mut self) -> Option<Self::Item> {
        let item = self.phases.get(self.index);
        self.index = self.index + 1;
        item
    }
}
