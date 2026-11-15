use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, js_name = error)]
    fn console_error(message: &str);
}

#[wasm_bindgen(start)]
pub fn log_panics() {
    std::panic::set_hook(Box::new(|info| console_error(&format!("[gpu-core] panic: {info}"))));
}
