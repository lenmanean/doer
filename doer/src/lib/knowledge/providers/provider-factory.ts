/**
 * Knowledge Provider Factory
 * Returns the appropriate knowledge provider instance
 */

import { NotionProvider } from './notion-provider'

export function getKnowledgeProvider(provider: 'notion'): NotionProvider {
  switch (provider) {
    case 'notion':
      return new NotionProvider()
    default:
      throw new Error(`Unknown knowledge provider: ${provider}`)
  }
}

