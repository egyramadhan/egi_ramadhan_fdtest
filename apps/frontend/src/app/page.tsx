'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpenIcon, UserGroupIcon, ShieldCheckIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'

interface Book {
  id: number
  title: string
  author: string
  description: string
  rating: number
  thumbnailUrl?: string
  createdAt: string
}

interface PaginationData {
  currentPage: number
  totalPages: number
  totalBooks: number
  hasNext: boolean
  hasPrev: boolean
}

export default function HomePage() {
  const { user, loading } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalBooks: 0,
    hasNext: false,
    hasPrev: false
  })
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAuthor, setSelectedAuthor] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [authors, setAuthors] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    if (isInitialLoad) {
      fetchBooks(1, true)
      setIsInitialLoad(false)
    } else {
      fetchBooks(currentPage)
    }
  }, [currentPage, searchQuery, selectedAuthor, minRating])

  const fetchBooks = async (page = 1, initial = false) => {
    try {
      setBooksLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: initial ? '6' : '12',
        ...(searchQuery && { search: searchQuery }),
        ...(selectedAuthor && { author: selectedAuthor }),
        ...(minRating > 0 && { minRating: minRating.toString() })
      })
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/books?${params}`)
      if (response.ok) {
        const data = await response.json()
        setBooks(data.data.books || [])
        setPagination(data.data.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalBooks: 0,
          hasNext: false,
          hasPrev: false
        })
        
        // Extract unique authors for filter dropdown
        if (initial) {
          const uniqueAuthors = [...new Set((data.data.books || []).map((book: Book) => book.author))]
          setAuthors(uniqueAuthors)
        }
      }
    } catch (error) {
      console.error('Failed to fetch books:', error)
    } finally {
      setBooksLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchBooks(1)
  }

  const handleFilterChange = () => {
    setCurrentPage(1)
    fetchBooks(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to books section
    document.getElementById('books')?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <BookOpenIcon className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                {process.env.NEXT_PUBLIC_APP_NAME}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-700">Welcome, {user.name}!</span>
                  <Link
                    href="/dashboard"
                    className="btn btn-primary px-4 py-2"
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="btn btn-outline px-4 py-2"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    className="btn btn-primary px-4 py-2"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Discover Amazing
              <span className="text-primary-600"> Books</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
              Explore our curated collection of books, manage your reading list, and connect with fellow book lovers.
              Join our community today!
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              {!user && (
                <>
                  <Link
                    href="/auth/register"
                    className="btn btn-primary px-6 py-3 text-base"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="#books"
                    className="btn btn-outline px-6 py-3 text-base"
                  >
                    Browse Books
                  </Link>
                </>
              )}
              {user && (
                <Link
                  href="/dashboard"
                  className="btn btn-primary px-6 py-3 text-base"
                >
                  Go to Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Why Choose Our Platform?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Everything you need to manage and discover books
            </p>
          </div>
          <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card text-center">
              <BookOpenIcon className="h-12 w-12 text-primary-600 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Extensive Library
              </h3>
              <p className="mt-2 text-gray-600">
                Access thousands of books across various genres and categories
              </p>
            </div>
            <div className="card text-center">
              <UserGroupIcon className="h-12 w-12 text-primary-600 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Community Driven
              </h3>
              <p className="mt-2 text-gray-600">
                Connect with other readers and share your favorite books
              </p>
            </div>
            <div className="card text-center">
              <ShieldCheckIcon className="h-12 w-12 text-primary-600 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                Secure & Private
              </h3>
              <p className="mt-2 text-gray-600">
                Your data is protected with enterprise-grade security
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Books Section */}
      <div id="books" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {isInitialLoad ? 'Featured Books' : 'Browse Books'}
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              {isInitialLoad ? 'Discover some of our most popular books' : `Found ${pagination.totalBooks} books`}
            </p>
          </div>
          
          {/* Search and Filters */}
          <div className="mt-12 mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              {/* Search Bar */}
              <form onSubmit={handleSearch} className="flex-1 max-w-md">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search books..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </form>
              
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FunnelIcon className="h-5 w-5" />
                Filters
              </button>
            </div>
            
            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Author Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Author
                    </label>
                    <select
                      value={selectedAuthor}
                      onChange={(e) => {
                        setSelectedAuthor(e.target.value)
                        handleFilterChange()
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">All Authors</option>
                      {authors.map((author) => (
                        <option key={author} value={author}>
                          {author}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Rating Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Rating
                    </label>
                    <select
                      value={minRating}
                      onChange={(e) => {
                        setMinRating(Number(e.target.value))
                        handleFilterChange()
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value={0}>Any Rating</option>
                      <option value={1}>1+ Stars</option>
                      <option value={2}>2+ Stars</option>
                      <option value={3}>3+ Stars</option>
                      <option value={4}>4+ Stars</option>
                      <option value={5}>5 Stars</option>
                    </select>
                  </div>
                </div>
                
                {/* Clear Filters */}
                {(searchQuery || selectedAuthor || minRating > 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedAuthor('')
                        setMinRating(0)
                        setCurrentPage(1)
                        fetchBooks(1)
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-8">
            {booksLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(isInitialLoad ? 6 : 12)].map((_, i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-48 bg-gray-200 rounded mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : books.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {books.map((book) => (
                    <div key={book.id} className="card hover:shadow-md transition-shadow">
                      {book.thumbnailUrl && (
                        <img
                          src={book.thumbnailUrl}
                          alt={book.title}
                          className="w-full h-48 object-cover rounded-md mb-4"
                        />
                      )}
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {book.title}
                      </h3>
                      <p className="text-gray-600 mb-2">by {book.author}</p>
                      <p className="text-sm text-gray-500 mb-3 line-clamp-3">
                        {book.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`h-4 w-4 ${
                                i < book.rating ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          <span className="ml-1 text-sm text-gray-600">({book.rating})</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="mt-12 flex items-center justify-center">
                    <nav className="flex items-center space-x-2">
                      {/* Previous Button */}
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!pagination.hasPrev}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${
                          pagination.hasPrev
                            ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        Previous
                      </button>
                      
                      {/* Page Numbers */}
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 rounded-md text-sm font-medium ${
                              pageNum === currentPage
                                ? 'text-white bg-primary-600 border border-primary-600'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                      
                      {/* Next Button */}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!pagination.hasNext}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${
                          pagination.hasNext
                            ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {searchQuery || selectedAuthor || minRating > 0
                    ? 'No books found matching your criteria.'
                    : 'No books available at the moment.'}
                </p>
                {(searchQuery || selectedAuthor || minRating > 0) && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedAuthor('')
                      setMinRating(0)
                      setCurrentPage(1)
                      fetchBooks(1)
                    }}
                    className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <BookOpenIcon className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                {process.env.NEXT_PUBLIC_APP_NAME}
              </span>
            </div>
            <p className="text-gray-600">
              © 2024 Egi Ramadhan. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}