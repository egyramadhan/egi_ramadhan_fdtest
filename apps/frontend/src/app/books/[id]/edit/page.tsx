'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'

const bookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  author: z.string().min(1, 'Author is required').max(255, 'Author must be less than 255 characters'),
  description: z.string().min(1, 'Description is required'),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5').optional().nullable(),
})

type BookFormData = z.infer<typeof bookSchema>

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

function EditBookPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)

  const bookId = params.id as string
  const API_URL = process.env.NEXT_PUBLIC_API_URL

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
  })

  const watchRating = watch('rating')

  useEffect(() => {
    if (bookId) {
      fetchBook()
    }
  }, [bookId])

  const getAuthHeaders = () => {
    const token = Cookies.get('accessToken')
    return {
      'Authorization': `Bearer ${token}`,
    }
  }

  const fetchBook = async () => {
    try {
      const response = await fetch(`${API_URL}/books/${bookId}`)

      if (response.ok) {
        const data = await response.json()
        const bookData = data.data
        setBook(bookData)
        
        // Set form values
        setValue('title', bookData.title)
        setValue('author', bookData.author)
        setValue('description', bookData.description)
        setValue('rating', bookData.rating)
        
        if (bookData.thumbnailUrl) {
          setThumbnailPreview(bookData.thumbnailUrl)
        }
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

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB in bytes
    if (file.size > maxSize) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setThumbnail(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setThumbnailPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeThumbnail = () => {
    setThumbnail(null)
    setThumbnailPreview(book?.thumbnailUrl || null)
    // Reset file input
    const fileInput = document.getElementById('thumbnail') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const onSubmit = async (data: BookFormData) => {
    if (!book) return
    
    // Check permissions
    if (!user || (user.id !== book.creator.id && !user.isAdmin)) {
      toast.error('You do not have permission to edit this book')
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('title', data.title)
      formData.append('author', data.author)
      formData.append('description', data.description)
      
      if (data.rating !== null && data.rating !== undefined) {
        formData.append('rating', data.rating.toString())
      }
      
      if (thumbnail) {
        formData.append('thumbnail', thumbnail)
      }

      const response = await fetch(`${API_URL}/books/${bookId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: formData,
      })

      if (response.ok) {
        toast.success('Book updated successfully!')
        router.push(`/books/${bookId}`)
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to update book')
      }
    } catch (error) {
      console.error('Error updating book:', error)
      toast.error('Failed to update book')
    } finally {
      setSubmitting(false)
    }
  }

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

  // Check permissions
  if (!user || (user.id !== book.creator.id && !user.isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">You do not have permission to edit this book.</p>
          <Link href={`/books/${bookId}`} className="text-primary-600 hover:text-primary-500">
            ← Back to Book Details
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
              <h1 className="text-xl font-bold text-gray-900">Edit Book</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href={`/books/${bookId}`} className="text-primary-600 hover:text-primary-500">
                ← Back to Book Details
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">
              Edit "{book.title}"
            </h3>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  {...register('title')}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter book title"
                />
                {errors.title && (
                  <p className="mt-2 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* Author */}
              <div>
                <label htmlFor="author" className="block text-sm font-medium text-gray-700">
                  Author *
                </label>
                <input
                  type="text"
                  id="author"
                  {...register('author')}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter author name"
                />
                {errors.author && (
                  <p className="mt-2 text-sm text-red-600">{errors.author.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description *
                </label>
                <textarea
                  id="description"
                  rows={4}
                  {...register('description')}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Enter book description"
                />
                {errors.description && (
                  <p className="mt-2 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Rating */}
              <div>
                <label htmlFor="rating" className="block text-sm font-medium text-gray-700">
                  Rating (1-5)
                </label>
                <div className="mt-1 flex items-center space-x-4">
                  <input
                    type="number"
                    id="rating"
                    min="1"
                    max="5"
                    step="0.1"
                    {...register('rating', { 
                      setValueAs: (value) => value === '' ? null : parseFloat(value) 
                    })}
                    className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="1-5"
                  />
                  {watchRating && (
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`h-5 w-5 ${
                            star <= Math.floor(watchRating)
                              ? 'text-yellow-400 fill-current'
                              : star <= watchRating
                              ? 'text-yellow-400 fill-current opacity-50'
                              : 'text-gray-300'
                          }`}
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      ))}
                      <span className="ml-2 text-sm text-gray-600">({watchRating.toFixed(1)})</span>
                    </div>
                  )}
                </div>
                {errors.rating && (
                  <p className="mt-2 text-sm text-red-600">{errors.rating.message}</p>
                )}
              </div>

              {/* Thumbnail */}
              <div>
                <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700">
                  Book Thumbnail
                </label>
                <div className="mt-1">
                  {thumbnailPreview && (
                    <div className="mb-4">
                      <div className="relative inline-block">
                        <img
                          src={thumbnailPreview}
                          alt="Thumbnail preview"
                          className="h-32 w-24 object-cover rounded-lg shadow-md"
                        />
                        <button
                          type="button"
                          onClick={removeThumbnail}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {thumbnail ? 'New thumbnail selected' : 'Current thumbnail'}
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    id="thumbnail"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleThumbnailChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Upload a new thumbnail image (JPEG, PNG, GIF, or WebP, max 5MB)
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <Link
                  href={`/books/${bookId}`}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Update Book'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditBookPage