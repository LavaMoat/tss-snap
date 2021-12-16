use rand::Rng;

fn main() {
    let mut hex_str = String::new();
    for _ in 0..32 {
        let num = rand::thread_rng().gen::<u8>();
        hex_str.push_str(&hex::encode(&[num]));
    }
    println!("{}", hex_str);
}
