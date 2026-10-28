const QOS_CLASS_USER_INTERACTIVE: u32 = 0x21;
const NO_RELATIVE_PRIORITY: i32 = 0;

extern "C" {
    fn pthread_set_qos_class_self_np(qos_class: u32, relative_priority: i32) -> i32;
}

pub fn interactive() {
    unsafe {
        pthread_set_qos_class_self_np(QOS_CLASS_USER_INTERACTIVE, NO_RELATIVE_PRIORITY);
    }
}
