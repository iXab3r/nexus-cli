// Nexus 3.96.3-01 request DTOs, selected from docs/api/nexus-openapi.json.
// Source SHA-256: 2d5261f26dd225103e886c0cb2becfa710b690a19e308a504cdd57a9293407ca
// Descriptions/examples omitted; native fields and constraints retained.
export const repositorySchemas: Record<string, any> = {
  "CargoHostedRepositoryApiRequest": {
    "required": [
      "name",
      "online",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/HostedStorageAttributes"
      },
      "cleanup": {
        "$ref": "#/components/schemas/CleanupPolicyAttributes"
      },
      "component": {
        "$ref": "#/components/schemas/ComponentAttributes"
      }
    }
  },
  "HostedStorageAttributes": {
    "required": [
      "blobStoreName",
      "strictContentTypeValidation",
      "writePolicy"
    ],
    "type": "object",
    "properties": {
      "blobStoreName": {
        "minLength": 1,
        "type": "string"
      },
      "strictContentTypeValidation": {
        "type": "boolean"
      },
      "writePolicy": {
        "type": "string"
      }
    }
  },
  "CleanupPolicyAttributes": {
    "type": "object",
    "properties": {
      "policyNames": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    }
  },
  "ComponentAttributes": {
    "type": "object",
    "properties": {
      "proprietaryComponents": {
        "type": "boolean"
      }
    }
  },
  "CargoProxyRepositoryApiRequest": {
    "required": [
      "httpClient",
      "name",
      "negativeCache",
      "online",
      "proxy",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/StorageAttributes"
      },
      "cleanup": {
        "$ref": "#/components/schemas/CleanupPolicyAttributes"
      },
      "proxy": {
        "$ref": "#/components/schemas/ProxyAttributes"
      },
      "negativeCache": {
        "$ref": "#/components/schemas/NegativeCacheAttributes"
      },
      "httpClient": {
        "$ref": "#/components/schemas/HttpClientAttributes"
      },
      "routingRuleName": {
        "type": "string"
      },
      "replication": {
        "$ref": "#/components/schemas/ReplicationAttributes"
      },
      "cargo": {
        "$ref": "#/components/schemas/CargoAttributes"
      },
      "firewall": {
        "$ref": "#/components/schemas/FirewallAttributes"
      }
    }
  },
  "StorageAttributes": {
    "required": [
      "blobStoreName",
      "strictContentTypeValidation"
    ],
    "type": "object",
    "properties": {
      "blobStoreName": {
        "minLength": 1,
        "type": "string"
      },
      "strictContentTypeValidation": {
        "type": "boolean"
      }
    }
  },
  "ProxyAttributes": {
    "required": [
      "contentMaxAge",
      "metadataMaxAge",
      "remoteUrl"
    ],
    "type": "object",
    "properties": {
      "remoteUrl": {
        "minLength": 1,
        "type": "string"
      },
      "contentMaxAge": {
        "type": "integer"
      },
      "metadataMaxAge": {
        "type": "integer"
      },
      "preserveEncodedCharacters": {
        "type": "boolean"
      }
    }
  },
  "NegativeCacheAttributes": {
    "required": [
      "enabled",
      "timeToLive"
    ],
    "type": "object",
    "properties": {
      "enabled": {
        "type": "boolean"
      },
      "timeToLive": {
        "type": "integer"
      }
    }
  },
  "HttpClientAttributes": {
    "type": "object",
    "properties": {
      "blocked": {
        "type": "boolean"
      },
      "autoBlock": {
        "type": "boolean"
      },
      "connection": {
        "$ref": "#/components/schemas/HttpClientConnectionAttributes"
      },
      "authentication": {
        "$ref": "#/components/schemas/HttpClientConnectionAuthenticationAttributes"
      }
    }
  },
  "HttpClientConnectionAttributes": {
    "type": "object",
    "properties": {
      "retries": {
        "maximum": 10,
        "minimum": 0,
        "type": "integer"
      },
      "userAgentSuffix": {
        "type": "string"
      },
      "timeout": {
        "maximum": 3600,
        "minimum": 1,
        "type": "integer"
      },
      "enableCircularRedirects": {
        "type": "boolean"
      },
      "enableCookies": {
        "type": "boolean"
      },
      "useTrustStore": {
        "type": "boolean"
      }
    }
  },
  "HttpClientConnectionAuthenticationAttributes": {
    "required": [
      "type"
    ],
    "type": "object",
    "properties": {
      "type": {
        "minLength": 1,
        "type": "string"
      },
      "username": {
        "type": "string"
      },
      "password": {
        "type": "string",
        "writeOnly": true
      },
      "ntlmHost": {
        "type": "string"
      },
      "ntlmDomain": {
        "type": "string"
      },
      "bearerToken": {
        "type": "string",
        "writeOnly": true
      }
    }
  },
  "ReplicationAttributes": {
    "required": [
      "preemptivePullEnabled"
    ],
    "type": "object",
    "properties": {
      "preemptivePullEnabled": {
        "type": "boolean"
      },
      "assetPathRegex": {
        "type": "string"
      }
    }
  },
  "CargoAttributes": {
    "type": "object",
    "properties": {
      "requireAuthentication": {
        "type": "boolean"
      }
    }
  },
  "FirewallAttributes": {
    "type": "object",
    "properties": {
      "mode": {
        "type": "string",
        "enum": [
          "DISABLED",
          "AUDIT",
          "QUARANTINE",
          "PCCS"
        ]
      }
    }
  },
  "CargoGroupRepositoryApiRequest": {
    "required": [
      "group",
      "name",
      "online",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/StorageAttributes"
      },
      "group": {
        "$ref": "#/components/schemas/GroupAttributes"
      },
      "cargo": {
        "$ref": "#/components/schemas/CargoAttributes"
      }
    }
  },
  "GroupAttributes": {
    "required": [
      "memberNames"
    ],
    "type": "object",
    "properties": {
      "memberNames": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    }
  },
  "NugetHostedRepositoryApiRequest": {
    "required": [
      "name",
      "online",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/HostedStorageAttributes"
      },
      "cleanup": {
        "$ref": "#/components/schemas/CleanupPolicyAttributes"
      },
      "component": {
        "$ref": "#/components/schemas/ComponentAttributes"
      }
    }
  },
  "NugetProxyRepositoryApiRequest": {
    "required": [
      "httpClient",
      "name",
      "negativeCache",
      "nugetProxy",
      "online",
      "proxy",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/StorageAttributes"
      },
      "cleanup": {
        "$ref": "#/components/schemas/CleanupPolicyAttributes"
      },
      "proxy": {
        "$ref": "#/components/schemas/ProxyAttributes"
      },
      "negativeCache": {
        "$ref": "#/components/schemas/NegativeCacheAttributes"
      },
      "httpClient": {
        "$ref": "#/components/schemas/HttpClientAttributes"
      },
      "routingRuleName": {
        "type": "string"
      },
      "nugetProxy": {
        "$ref": "#/components/schemas/NugetAttributes"
      },
      "replication": {
        "$ref": "#/components/schemas/ReplicationAttributes"
      },
      "firewall": {
        "$ref": "#/components/schemas/FirewallAttributes"
      }
    }
  },
  "NugetAttributes": {
    "type": "object",
    "properties": {
      "queryCacheItemMaxAge": {
        "type": "integer"
      },
      "nugetVersion": {
        "type": "string",
        "enum": [
          "V2",
          "V3"
        ]
      },
      "symbolServerUrl": {
        "maxLength": 2048,
        "minLength": 0,
        "type": "string"
      },
      "allowAnonymousSymbolAccess": {
        "type": "boolean"
      }
    }
  },
  "NugetGroupRepositoryApiRequest": {
    "required": [
      "group",
      "name",
      "online",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/StorageAttributes"
      },
      "group": {
        "$ref": "#/components/schemas/GroupAttributes"
      }
    }
  },
  "NpmHostedRepositoryApiRequest": {
    "required": [
      "name",
      "online",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/HostedStorageAttributes"
      },
      "cleanup": {
        "$ref": "#/components/schemas/CleanupPolicyAttributes"
      },
      "component": {
        "$ref": "#/components/schemas/ComponentAttributes"
      }
    }
  },
  "NpmProxyRepositoryApiRequest": {
    "required": [
      "httpClient",
      "name",
      "negativeCache",
      "online",
      "proxy",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/StorageAttributes"
      },
      "cleanup": {
        "$ref": "#/components/schemas/CleanupPolicyAttributes"
      },
      "proxy": {
        "$ref": "#/components/schemas/ProxyAttributes"
      },
      "negativeCache": {
        "$ref": "#/components/schemas/NegativeCacheAttributes"
      },
      "httpClient": {
        "$ref": "#/components/schemas/HttpClientAttributes"
      },
      "routingRule": {
        "type": "string",
        "writeOnly": true
      },
      "replication": {
        "$ref": "#/components/schemas/ReplicationAttributes"
      },
      "routingRuleName": {
        "type": "string"
      },
      "firewall": {
        "$ref": "#/components/schemas/FirewallAttributes"
      }
    }
  },
  "NpmGroupRepositoryApiRequest": {
    "required": [
      "group",
      "name",
      "online",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/StorageAttributes"
      },
      "group": {
        "$ref": "#/components/schemas/GroupDeployAttributes"
      }
    }
  },
  "GroupDeployAttributes": {
    "required": [
      "memberNames"
    ],
    "type": "object",
    "properties": {
      "memberNames": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "writableMember": {
        "type": "string"
      }
    }
  },
  "DockerHostedRepositoryApiRequest": {
    "required": [
      "docker",
      "name",
      "online",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/DockerHostedStorageAttributes"
      },
      "cleanup": {
        "$ref": "#/components/schemas/CleanupPolicyAttributes"
      },
      "docker": {
        "$ref": "#/components/schemas/DockerAttributes"
      },
      "component": {
        "$ref": "#/components/schemas/ComponentAttributes"
      }
    }
  },
  "DockerHostedStorageAttributes": {
    "required": [
      "blobStoreName",
      "strictContentTypeValidation",
      "writePolicy"
    ],
    "type": "object",
    "properties": {
      "blobStoreName": {
        "minLength": 1,
        "type": "string"
      },
      "strictContentTypeValidation": {
        "type": "boolean"
      },
      "writePolicy": {
        "type": "string"
      },
      "latestPolicy": {
        "type": "boolean"
      }
    }
  },
  "DockerAttributes": {
    "required": [
      "forceBasicAuth",
      "v1Enabled"
    ],
    "type": "object",
    "properties": {
      "v1Enabled": {
        "type": "boolean"
      },
      "forceBasicAuth": {
        "type": "boolean"
      },
      "httpPort": {
        "type": "integer"
      },
      "httpsPort": {
        "type": "integer"
      },
      "subdomain": {
        "type": "string"
      },
      "pathEnabled": {
        "type": "boolean"
      }
    }
  },
  "DockerProxyRepositoryApiRequest": {
    "required": [
      "docker",
      "dockerProxy",
      "httpClient",
      "name",
      "negativeCache",
      "online",
      "proxy",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/StorageAttributes"
      },
      "cleanup": {
        "$ref": "#/components/schemas/CleanupPolicyAttributes"
      },
      "docker": {
        "$ref": "#/components/schemas/DockerAttributes"
      },
      "dockerProxy": {
        "$ref": "#/components/schemas/DockerProxyAttributes"
      },
      "proxy": {
        "$ref": "#/components/schemas/ProxyAttributes"
      },
      "negativeCache": {
        "$ref": "#/components/schemas/NegativeCacheAttributes"
      },
      "httpClient": {
        "$ref": "#/components/schemas/HttpClientAttributes"
      },
      "routingRuleName": {
        "type": "string"
      },
      "replication": {
        "$ref": "#/components/schemas/ReplicationAttributes"
      },
      "firewall": {
        "$ref": "#/components/schemas/FirewallAttributes"
      }
    }
  },
  "DockerProxyAttributes": {
    "required": [
      "indexType"
    ],
    "type": "object",
    "properties": {
      "indexType": {
        "minLength": 1,
        "type": "string",
        "enum": [
          "HUB",
          "REGISTRY",
          "CUSTOM"
        ]
      },
      "indexUrl": {
        "type": "string"
      },
      "cacheForeignLayers": {
        "type": "boolean"
      },
      "foreignLayerUrlWhitelist": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "ecrAuth": {
        "$ref": "#/components/schemas/EcrAuthAttributes"
      }
    }
  },
  "EcrAuthAttributes": {
    "type": "object",
    "properties": {
      "enabled": {
        "type": "boolean"
      },
      "awsRegion": {
        "type": "string"
      },
      "registryId": {
        "type": "string"
      },
      "accessKeyId": {
        "type": "string"
      },
      "secretAccessKey": {
        "type": "string",
        "writeOnly": true
      },
      "sessionToken": {
        "type": "string",
        "writeOnly": true
      }
    }
  },
  "DockerGroupRepositoryApiRequest": {
    "required": [
      "docker",
      "group",
      "name",
      "online",
      "storage"
    ],
    "type": "object",
    "properties": {
      "name": {
        "minLength": 1,
        "pattern": "^[a-zA-Z0-9\\-]{1}[a-zA-Z0-9_\\-\\.]*$",
        "type": "string"
      },
      "online": {
        "type": "boolean"
      },
      "storage": {
        "$ref": "#/components/schemas/StorageAttributes"
      },
      "group": {
        "$ref": "#/components/schemas/GroupDeployAttributes"
      },
      "docker": {
        "$ref": "#/components/schemas/DockerAttributes"
      }
    }
  }
};
