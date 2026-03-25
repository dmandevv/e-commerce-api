export const config = {
  port: parseInt(process.env.PORT || '3007'),
  services: [
    { name: 'user-service', url: process.env.USER_SERVICE_URL || 'http://user-service:3001' },
    { name: 'product-service', url: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002' },
    { name: 'cart-service', url: process.env.CART_SERVICE_URL || 'http://cart-service:3003' },
    { name: 'order-service', url: process.env.ORDER_SERVICE_URL || 'http://order-service:3004' },
    { name: 'payment-service', url: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3005' },
    { name: 'notification-service', url: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006' },
  ],
};
