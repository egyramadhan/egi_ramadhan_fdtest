import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixThumbnailUrls() {
  try {
    console.log('Starting thumbnail URL migration...');
    
    // Find all books with thumbnailUrl that doesn't include 'thumbnails'
    const booksToUpdate = await prisma.book.findMany({
      where: {
        AND: [
          {
            thumbnailUrl: {
              not: null
            }
          },
          {
            thumbnailUrl: {
              contains: '/uploads/'
            }
          },
          {
            thumbnailUrl: {
              not: {
                contains: '/uploads/thumbnails/'
              }
            }
          }
        ]
      }
    });
    
    console.log(`Found ${booksToUpdate.length} books with old thumbnail URL format`);
    
    // Update each book's thumbnailUrl
    for (const book of booksToUpdate) {
      const oldUrl = book.thumbnailUrl;
      // Replace /uploads/ with /uploads/thumbnails/
      const newUrl = oldUrl.replace('/uploads/', '/uploads/thumbnails/');
      
      await prisma.book.update({
        where: { id: book.id },
        data: { thumbnailUrl: newUrl }
      });
      
      console.log(`Updated book ${book.id}: ${oldUrl} -> ${newUrl}`);
    }
    
    console.log('Thumbnail URL migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixThumbnailUrls();