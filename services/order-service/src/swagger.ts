const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Order Service API',
    version: '1.0.0',
    description: 'Order placement, tracking, and management. Automatically creates payments via RabbitMQ events.',
  },
  servers: [{ url: '/api/orders' }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] },
          total: { type: 'string', example: '99.98' },
          stripePaymentId: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
        },
      },
      OrderItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          productId: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'string' },
          quantity: { type: 'integer' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/': {
      post: {
        summary: 'Place an order from current cart',
        description: 'Fetches the user\'s cart, creates an order in PostgreSQL, clears the cart, and publishes an order.placed event (which triggers automatic payment creation).',
        tags: ['Orders'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  shippingAddress: { type: 'string', example: '123 Main St, City, State 12345' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Order created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Order' },
                  },
                },
              },
            },
          },
          '400': { description: 'Cart is empty' },
        },
      },
    },
    '/mine': {
      get: {
        summary: 'Get my orders',
        tags: ['Orders'],
        responses: {
          '200': {
            description: 'List of user\'s orders',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/{id}': {
      get: {
        summary: 'Get order by ID',
        tags: ['Orders'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Order details' },
          '404': { description: 'Order not found' },
        },
      },
    },
    '/{id}/status': {
      patch: {
        summary: 'Update order status (admin)',
        tags: ['Orders'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Status updated' },
          '404': { description: 'Order not found' },
        },
      },
    },
  },
};

export default spec;
