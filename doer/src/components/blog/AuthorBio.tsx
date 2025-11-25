'use client'

import { BlogAuthor } from '@/data/blog'
import { Twitter, Linkedin } from 'lucide-react'

interface AuthorBioProps {
  author: BlogAuthor
}

export function AuthorBio({ author }: AuthorBioProps) {
  return (
    <div className="flex gap-4 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0">
        {author.avatar ? (
          <img
            src={author.avatar}
            alt={author.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xl">
            {author.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          {author.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {author.role}
        </p>
        {author.bio && (
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            {author.bio}
          </p>
        )}
        {(author.social?.twitter || author.social?.linkedin) && (
          <div className="flex items-center gap-3">
            {author.social.twitter && (
              <a
                href={`https://twitter.com/${author.social.twitter.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                aria-label={`${author.name} on Twitter`}
              >
                <Twitter className="w-5 h-5" />
              </a>
            )}
            {author.social.linkedin && (
              <a
                href={`https://linkedin.com/in/${author.social.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors"
                aria-label={`${author.name} on LinkedIn`}
              >
                <Linkedin className="w-5 h-5" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

