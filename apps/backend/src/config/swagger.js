import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Book Management API',
      version: '1.0.0',
      description: 'A comprehensive API for managing books, users, and authentication in a book management system',
      contact: {
        name: 'API Support',
        email: 'support@bookmanagement.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme. Example: "Authorization: Bearer {token}"'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the user'
            },
            name: {
              type: 'string',
              description: 'Full name of the user',
              example: 'John Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address of the user',
              example: 'john.doe@example.com'
            },
            isAdmin: {
              type: 'boolean',
              description: 'Whether the user has admin privileges',
              default: false
            },
            emailVerifiedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when email was verified',
              nullable: true
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp of last login',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when user was created'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when user was last updated'
            }
          }
        },
        Book: {
          type: 'object',
          required: ['title', 'author', 'description'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the book'
            },
            title: {
              type: 'string',
              description: 'Title of the book',
              example: 'The Great Gatsby'
            },
            author: {
              type: 'string',
              description: 'Author of the book',
              example: 'F. Scott Fitzgerald'
            },
            description: {
              type: 'string',
              description: 'Description of the book',
              example: 'A classic American novel set in the Jazz Age'
            },
            rating: {
              type: 'number',
              minimum: 1,
              maximum: 5,
              description: 'Rating of the book (1-5)',
              example: 4.5,
              nullable: true
            },
            thumbnailUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL to the book thumbnail image',
              nullable: true
            },
            createdBy: {
              type: 'string',
              description: 'ID of the user who created the book'
            },
            creator: {
              $ref: '#/components/schemas/User'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when book was created'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when book was last updated'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com'
            },
            password: {
              type: 'string',
              description: 'User password',
              example: 'password123'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              description: 'Full name of the user',
              example: 'John Doe'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@example.com'
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password (minimum 6 characters)',
              example: 'password123'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Login successful'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User'
                },
                tokens: {
                  type: 'object',
                  properties: {
                    accessToken: {
                      type: 'string',
                      description: 'JWT access token'
                    },
                    refreshToken: {
                      type: 'string',
                      description: 'JWT refresh token'
                    }
                  }
                }
              }
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            error: {
              type: 'string',
              description: 'Detailed error information'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {}
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: {
                      type: 'integer',
                      example: 1
                    },
                    limit: {
                      type: 'integer',
                      example: 10
                    },
                    total: {
                      type: 'integer',
                      example: 100
                    },
                    totalPages: {
                      type: 'integer',
                      example: 10
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/app.js'
  ]
}

const specs = swaggerJSDoc(options);

export { specs };
export { swaggerUi };