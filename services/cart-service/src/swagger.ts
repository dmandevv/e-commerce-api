const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Cart Service API',
    version: '1.0.0',
    description: 'Shopping cart management. All routes require authentication. Cart data is stored in Redis with a 72-hour TTL.',
  },
  servers: [{ url: '/api/cart' }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      CartItem: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          quantity: { type: 'integer' },
          image: { type: 'string' },
        },
      },
      Cart: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          items: { type: 'array', items: { $ref: '#/components/schemas/CartItem' } },
          totalPrice: { type: 'number' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/': {
      get: {
        summary: 'Get current user\'s cart',
        tags: ['Cart'],
        responses: {
          '200': {
            description: 'Cart contents',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Cart' },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Clear the entire cart',
        tags: ['Cart'],
        responses: {
          '200': { description: 'Cart cleared' },
        },
      },
    },
    '/items': {
      post: {
        summary: 'Add an item to cart',
        tags: ['Cart'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'name', 'price', 'quantity'],
                properties: {
                  productId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                  name: { type: 'string', example: 'Wireless Headphones' },
                  price: { type: 'number', example: 79.99 },
                  quantity: { type: 'integer', minimum: 1, example: 2 },
                  image: { type: 'string', example: 'https://example.com/img.jpg' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Item added, returns updated cart' },
          '400': { description: 'Missing required fields' },
        },
      },
    },
    '/items/{productId}': {
      patch: {
        summary: 'Update item quantity',
        tags: ['Cart'],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['quantity'],
                properties: {
                  quantity: { type: 'integer', minimum: 1, example: 3 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Quantity updated, returns updated cart' },
          '400': { description: 'Quantity must be at least 1' },
        },
      },
      delete: {
        summary: 'Remove an item from cart',
        tags: ['Cart'],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Item removed, returns updated cart' },
        },
      },
    },
  },
};

export default spec;
