// Selected Nexus 3.96.3-01 DTOs from docs/api/nexus-openapi.json.
// Source SHA-256: 2d5261f26dd225103e886c0cb2becfa710b690a19e308a504cdd57a9293407ca
export const securitySchemas: Record<string, any> = {
  "AnonymousAccessSettingsXO": {
    "required": [
      "realmName",
      "userId"
    ],
    "type": "object",
    "properties": {
      "enabled": {
        "type": "boolean"
      },
      "userId": {
        "minLength": 1,
        "type": "string"
      },
      "realmName": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "RealmApiXO": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      }
    }
  },
  "RoleXORequest": {
    "required": [
      "id",
      "name"
    ],
    "type": "object",
    "properties": {
      "id": {
        "minLength": 1,
        "type": "string"
      },
      "name": {
        "minLength": 1,
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "privileges": {
        "uniqueItems": true,
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "roles": {
        "uniqueItems": true,
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    }
  },
  "RoleXOResponse": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "source": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "readOnly": {
        "type": "boolean"
      },
      "privileges": {
        "uniqueItems": true,
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "roles": {
        "uniqueItems": true,
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    }
  },
  "ApiCreateUser": {
    "required": [
      "emailAddress",
      "firstName",
      "lastName",
      "password",
      "status",
      "userId"
    ],
    "type": "object",
    "properties": {
      "userId": {
        "minLength": 1,
        "type": "string"
      },
      "firstName": {
        "minLength": 1,
        "type": "string"
      },
      "lastName": {
        "minLength": 1,
        "type": "string"
      },
      "emailAddress": {
        "minLength": 1,
        "type": "string",
        "format": "email"
      },
      "password": {
        "minLength": 1,
        "type": "string"
      },
      "status": {
        "type": "string",
        "enum": [
          "active",
          "locked",
          "disabled",
          "changepassword"
        ]
      },
      "roles": {
        "uniqueItems": true,
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    }
  },
  "ApiUser": {
    "required": [
      "source",
      "status",
      "userId"
    ],
    "type": "object",
    "properties": {
      "userId": {
        "minLength": 1,
        "type": "string"
      },
      "firstName": {
        "type": "string",
        "nullable": true
      },
      "lastName": {
        "type": "string",
        "nullable": true
      },
      "emailAddress": {
        "type": "string",
        "format": "email",
        "nullable": true
      },
      "source": {
        "minLength": 1,
        "type": "string"
      },
      "status": {
        "type": "string",
        "enum": [
          "active",
          "locked",
          "disabled",
          "changepassword"
        ]
      },
      "readOnly": {
        "type": "boolean"
      },
      "roles": {
        "uniqueItems": true,
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "externalRoles": {
        "uniqueItems": true,
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    }
  },
  "ApiPrivilegeRepositoryViewRequest": {
    "required": [
      "actions",
      "format",
      "name",
      "repository"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "actions": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "READ",
            "BROWSE",
            "EDIT",
            "ADD",
            "DELETE",
            "RUN",
            "START",
            "STOP",
            "ASSOCIATE",
            "DISASSOCIATE",
            "ALL"
          ]
        }
      },
      "format": {
        "minLength": 1,
        "type": "string"
      },
      "repository": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ApiPrivilegeRepositoryContentSelectorRequest": {
    "required": [
      "actions",
      "contentSelector",
      "format",
      "name",
      "repository"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "actions": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "READ",
            "BROWSE",
            "EDIT",
            "ADD",
            "DELETE",
            "RUN",
            "START",
            "STOP",
            "ASSOCIATE",
            "DISASSOCIATE",
            "ALL"
          ]
        }
      },
      "format": {
        "minLength": 1,
        "type": "string"
      },
      "repository": {
        "minLength": 1,
        "type": "string"
      },
      "contentSelector": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ContentSelectorApiCreateRequest": {
    "required": [
      "expression",
      "name"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "expression": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ContentSelectorApiUpdateRequest": {
    "required": [
      "expression"
    ],
    "type": "object",
    "properties": {
      "description": {
        "type": "string"
      },
      "expression": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ContentSelectorApiResponse": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "type": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "expression": {
        "type": "string"
      }
    }
  },
  "ApiPrivilegeApplication": {
    "required": [
      "actions",
      "domain",
      "name"
    ],
    "type": "object",
    "properties": {
      "type": {
        "type": "string"
      },
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "readOnly": {
        "type": "boolean"
      },
      "actions": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "READ",
            "BROWSE",
            "EDIT",
            "ADD",
            "DELETE",
            "RUN",
            "START",
            "STOP",
            "ASSOCIATE",
            "DISASSOCIATE",
            "ALL"
          ]
        }
      },
      "domain": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ApiPrivilegeWildcard": {
    "required": [
      "name",
      "pattern"
    ],
    "type": "object",
    "properties": {
      "type": {
        "type": "string"
      },
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "readOnly": {
        "type": "boolean"
      },
      "pattern": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ApiPrivilegeRepositoryAdmin": {
    "required": [
      "actions",
      "format",
      "name",
      "repository"
    ],
    "type": "object",
    "properties": {
      "type": {
        "type": "string"
      },
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "readOnly": {
        "type": "boolean"
      },
      "actions": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "READ",
            "BROWSE",
            "EDIT",
            "ADD",
            "DELETE",
            "RUN",
            "START",
            "STOP",
            "ASSOCIATE",
            "DISASSOCIATE",
            "ALL"
          ]
        }
      },
      "format": {
        "minLength": 1,
        "type": "string"
      },
      "repository": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ApiPrivilegeRepositoryView": {
    "required": [
      "actions",
      "format",
      "name",
      "repository"
    ],
    "type": "object",
    "properties": {
      "type": {
        "type": "string"
      },
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "readOnly": {
        "type": "boolean"
      },
      "actions": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "READ",
            "BROWSE",
            "EDIT",
            "ADD",
            "DELETE",
            "RUN",
            "START",
            "STOP",
            "ASSOCIATE",
            "DISASSOCIATE",
            "ALL"
          ]
        }
      },
      "format": {
        "minLength": 1,
        "type": "string"
      },
      "repository": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ApiPrivilegeRepositoryContentSelector": {
    "required": [
      "actions",
      "contentSelector",
      "format",
      "name",
      "repository"
    ],
    "type": "object",
    "properties": {
      "type": {
        "type": "string"
      },
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "readOnly": {
        "type": "boolean"
      },
      "actions": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "READ",
            "BROWSE",
            "EDIT",
            "ADD",
            "DELETE",
            "RUN",
            "START",
            "STOP",
            "ASSOCIATE",
            "DISASSOCIATE",
            "ALL"
          ]
        }
      },
      "format": {
        "minLength": 1,
        "type": "string"
      },
      "repository": {
        "minLength": 1,
        "type": "string"
      },
      "contentSelector": {
        "minLength": 1,
        "type": "string"
      }
    }
  },
  "ApiPrivilegeScript": {
    "required": [
      "actions",
      "name",
      "scriptName"
    ],
    "type": "object",
    "properties": {
      "type": {
        "type": "string"
      },
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "readOnly": {
        "type": "boolean"
      },
      "actions": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string",
          "enum": [
            "READ",
            "BROWSE",
            "EDIT",
            "ADD",
            "DELETE",
            "RUN",
            "START",
            "STOP",
            "ASSOCIATE",
            "DISASSOCIATE",
            "ALL"
          ]
        }
      },
      "scriptName": {
        "minLength": 1,
        "type": "string"
      }
    }
  }
};
