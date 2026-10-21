use std::collections::HashMap;
use std::sync::Arc;

use vello::Scene;

#[derive(Clone, Default)]
pub struct Fragments(Arc<HashMap<String, Arc<Scene>>>);

impl Fragments {
    pub fn new(encoded: HashMap<String, Arc<Scene>>) -> Self {
        Fragments(Arc::new(encoded))
    }

    pub fn get(&self, group: &str) -> Option<&Scene> {
        self.0.get(group).map(|s| s.as_ref())
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl std::fmt::Debug for Fragments {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Fragments({})", self.0.len())
    }
}
