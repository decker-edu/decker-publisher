export function randomString(length : number, characters? : string) {
    let result = "";
    let options = characters
      ? characters
      : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let amount = options.length;
    for (let i = 0; i < length; i++) {
      result += options.charAt(Math.floor(Math.random() * amount));
    }
    return result;
}