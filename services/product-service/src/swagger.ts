const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Product Service API',
    version: '1.0.0',
    description: 'Product catalog, reviews, search, and filtering.',
  },
  servers: [{ url: '/api/products' }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          category: { type: 'string' },
          stock: { type: 'integer' },
          rating: { type: 'number' },
          numOfReviews: { type: 'integer' },
          reviews: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
          createdBy: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Review: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          name: { type: 'string' },
          rating: { type: 'number', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        summary: 'Get all products',
        description: 'Supports search (?keyword=), filtering (?price[gte]=10), sorting (?sort=price), and pagination (?page=1).',
        tags: ['Products'],
        parameters: [
          { name: 'keyword', in: 'query', schema: { type: 'string' }, description: 'Search by name' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
          { name: 'price[gte]', in: 'query', schema: { type: 'number' }, description: 'Min price' },
          { name: 'price[lte]', in: 'query', schema: { type: 'number' }, description: 'Max price' },
          { name: 'sort', in: 'query', schema: { type: 'string' }, description: 'Sort field (e.g. price, -price)' },
          { name: 'page', in: 'query', schema: { type: 'integer' }, description: 'Page number' },
        ],
        responses: {
          '200': {
            description: 'List of products',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a product (admin)',
        tags: ['Products'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'description', 'price', 'category', 'stock'],
                properties: {
                  name: { type: 'string', example: 'Wireless Headphones' },
                  description: { type: 'string', example: 'Noise-cancelling bluetooth headphones' },
                  price: { type: 'number', example: 79.99 },
                  category: { type: 'string', example: 'Electronics' },
                  stock: { type: 'integer', example: 50 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Product created' },
          '401': { description: 'Not authenticated' },
          '403': { description: 'Not authorized (admin only)' },
        },
      },
    },
    '/{id}': {
      get: {
        summary: 'Get a single product',
        tags: ['Products'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Product details' },
          '404': { description: 'Product not found' },
        },
      },
      patch: {
        summary: 'Update a product (admin)',
        tags: ['Products'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                  stock: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Product updated' },
          '404': { description: 'Product not found' },
        },
      },
      delete: {
        summary: 'Delete a product (admin)',
        tags: ['Products'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Product deleted' },
          '404': { description: 'Product not found' },
        },
      },
    },
    '/{id}/reviews': {
      get: {
        summary: 'Get reviews for a product',
        tags: ['Reviews'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'List of reviews' } },
      },
    },
    '/reviews': {
      post: {
        summary: 'Create or update a review',
        tags: ['Reviews'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'rating'],
                properties: {
                  productId: { type: 'string' },
                  rating: { type: 'number', minimum: 1, maximum: 5, example: 4 },
                  comment: { type: 'string', example: 'Great product!' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Review saved' },
          '404': { description: 'Product not found' },
        },
      },
      delete: {
        summary: 'Delete a review (admin)',
        tags: ['Reviews'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'productId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'reviewId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Review deleted' } },
      },
    },
  },
};

export default spec;
