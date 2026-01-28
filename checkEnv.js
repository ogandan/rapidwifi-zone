import dotenv from 'dotenv';
dotenv.config();

console.log("MOMO_SUBSCRIPTION_KEY:", process.env.MOMO_SUBSCRIPTION_KEY);
console.log("MOMO_API_USER:", process.env.MOMO_API_USER);
console.log("GATEWAY_SECRET:", process.env.GATEWAY_SECRET);
console.log("MOMO_CALLBACK_HOST:", process.env.MOMO_CALLBACK_HOST);

