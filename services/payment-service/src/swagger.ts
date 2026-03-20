const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Payment Service API',
    version: '1.0.0',
    description: 'Stripe payment processing. Payments are auto-created via RabbitMQ when an order is placed. The Stripe webhook updates payment status and notifies other services.',
  },
  servers: [{ url: '/api/payments' }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          userId: { type: 'string' },
          amount: { type: 'string', example: '99.98' },
          currency: { type: 'string', example: 'usd' },
          status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] },
          stripePaymentId: { type: 'string' },
          stripeClientSecret: { type: 'string', description: 'Used by frontend to confirm payment with Stripe.js' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/{orderId}': {
      get: {
        summary: 'Get payment for an order',
        description: 'Returns payment details including the stripeClientSecret needed by the frontend to confirm payment with Stripe.js.',
        tags: ['Payments'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Payment details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Payment' },
                  },
                },
              },
            },
          },
          '404': { description: 'Payment not found' },
        },
      },
    },
    '/webhook': {
      post: {
        summary: 'Stripe webhook endpoint',
        description: 'Called by Stripe when a payment succeeds or fails. Verifies the webhook signature in production. Publishes payment.completed or payment.failed events via RabbitMQ.',
        tags: ['Webhook'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', description: 'Stripe event payload' },
            },
          },
        },
        responses: {
          '200': { description: 'Webhook acknowledged' },
        },
      },
    },
  },
};

export default spec;
