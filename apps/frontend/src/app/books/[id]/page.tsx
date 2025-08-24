'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'

interface Book {
  id: string
  title: string
  author: string
  description: string
  thumbnailUrl: string | null
  rating: number | null
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string
    email: string
  }
}

function BookDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const bookId = params.id as string
  const API_URL = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    if (bookId) {
      fetchBook()
    }
  }, [bookId])

  const getAuthHeaders = () => {
    const token = Cookies.get('accessToken')
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  const fetchBook = async () => {
    try {
      const response = await fetch(`${API_URL}/books/${bookId}`)

      if (response.ok) {
        const data = await response.json()
        setBook(data.data)
      } else if (response.status === 404) {
        toast.error('Book not found')
        router.push('/dashboard')
      } else {
        toast.error('Failed to fetch book details')
      }
    } catch (error) {
      console.error('Error fetching book:', error)
      toast.error('Failed to fetch book details')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!book) return

    if (!confirm(`Are you sure you want to delete "${book.title}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)

    try {
      const response = await fetch(`${API_URL}/books/${bookId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        toast.success('Book deleted successfully')
        router.push('/dashboard')
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to delete book')
      }
    } catch (error) {
      console.error('Error deleting book:', error)
      toast.error('Failed to delete book')
    } finally {
      setDeleting(false)
    }
  }

  const canEdit = user && (user.id === book?.creator.id || user.isAdmin)
  const canDelete = user && (user.id === book?.creator.id || user.isAdmin)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Book not found</h2>
          <Link href="/dashboard" className="text-primary-600 hover:text-primary-500">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">Book Details</h1>
            </div>
            <div className="flex items-center space-x-4">
              {canEdit && (
                <Link
                  href={`/books/${bookId}/edit`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Edit Book
                </Link>
              )}
              <Link href="/dashboard" className="text-primary-600 hover:text-primary-500">
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-2xl leading-6 font-bold text-gray-900">{book.title}</h3>
                <p className="mt-1 text-lg text-gray-600">by {book.author}</p>
                <div className="mt-2 flex items-center space-x-4">
                  {book.rating && (
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      <span className="ml-1 text-sm font-medium text-gray-700">{book.rating.toFixed(1)}</span>
                    </div>
                  )}
                  <span className="text-sm text-gray-500">
                    Created on {new Date(book.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {book.thumbnailUrl && (
                <div className="ml-6 flex-shrink-0">
                  <img
                    src={book.thumbnailUrl}
                    alt={book.title}
                    className="h-48 w-36 object-cover rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <p className="whitespace-pre-wrap">{book.description}</p>
                </dd>
              </div>
              
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Author</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{book.author}</dd>
              </div>
              
              {book.rating && (
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Rating</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`h-5 w-5 ${
                              star <= Math.floor(book.rating!)
                                ? 'text-yellow-400 fill-current'
                                : star <= book.rating!
                                ? 'text-yellow-400 fill-current opacity-50'
                                : 'text-gray-300'
                            }`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        ))}
                      </div>
                      <span className="ml-2 text-sm text-gray-600">({book.rating.toFixed(1)})</span>
                    </div>
                  </dd>
                </div>
              )}
              
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Created by</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{book.creator.name}</dd>
              </div>
              
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Created on</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {new Date(book.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </dd>
              </div>
              
              {book.updatedAt !== book.createdAt && (
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Last updated</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {new Date(book.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          
          {/* Action Buttons */}
          {(canEdit || canDelete) && (
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="flex justify-end space-x-3">
                {canEdit && (
                  <Link
                    href={`/books/${bookId}/edit`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Edit Book
                  </Link>
                )}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      'Delete Book'
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookDetailPage