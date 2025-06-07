const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Manufacturing Planning Board API',
      version: '1.0.0',
      description: 'API for managing manufacturing orders, work centres, and external system integration',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.manufacturing.company.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authenticated users'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for external system integration'
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication information is missing or invalid',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'integer',
                    example: 401
                  },
                  code: {
                    type: 'string',
                    example: 'AUTH_REQUIRED'
                  },
                  message: {
                    type: 'string',
                    example: 'Authentication required'
                  }
                }
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions to access this resource',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'integer',
                    example: 403
                  },
                  code: {
                    type: 'string',
                    example: 'INSUFFICIENT_PERMISSIONS'
                  },
                  message: {
                    type: 'string',
                    example: 'You do not have permission to perform this action'
                  }
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'integer',
                    example: 400
                  },
                  code: {
                    type: 'string',
                    example: 'VALIDATION_ERROR'
                  },
                  message: {
                    type: 'string',
                    example: 'Validation failed'
                  },
                  details: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        field: {
                          type: 'string'
                        },
                        message: {
                          type: 'string'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'integer',
                    example: 404
                  },
                  code: {
                    type: 'string',
                    example: 'NOT_FOUND'
                  },
                  message: {
                    type: 'string',
                    example: 'The requested resource was not found'
                  }
                }
              }
            }
          }
        },
        ConflictError: {
          description: 'Resource conflict',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'integer',
                    example: 409
                  },
                  code: {
                    type: 'string',
                    example: 'CONFLICT'
                  },
                  message: {
                    type: 'string',
                    example: 'A resource with this identifier already exists'
                  }
                }
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'integer',
                    example: 429
                  },
                  code: {
                    type: 'string',
                    example: 'RATE_LIMIT_EXCEEDED'
                  },
                  message: {
                    type: 'string',
                    example: 'Too many requests. Please try again later.'
                  }
                }
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'integer',
                    example: 500
                  },
                  code: {
                    type: 'string',
                    example: 'INTERNAL_ERROR'
                  },
                  message: {
                    type: 'string',
                    example: 'An unexpected error occurred'
                  }
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'API Keys',
        description: 'API key management for external systems'
      },
      {
        name: 'Orders',
        description: 'Manufacturing order management'
      },
      {
        name: 'Work Centres',
        description: 'Work centre management'
      },
      {
        name: 'External Integration',
        description: 'Endpoints for external system integration'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/middleware/*.js'
  ]
};

const specs = swaggerJSDoc(options);

const swaggerOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Manufacturing API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha'
  }
};

module.exports = {
  specs,
  swaggerUi,
  swaggerOptions
};