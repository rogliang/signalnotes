import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileName, fileType } = await request.json()

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: 'fileName and fileType required' },
        { status: 400 }
      )
    }

    // Generate unique key
    const key = `uploads/${Date.now()}-${fileName}`

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: fileType,
      ACL: 'public-read', // Make uploaded files public
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

    // Public URL for accessing the file - URL encode the key
    const encodedKey = key.split('/').map(part => encodeURIComponent(part)).join('/')
    const publicUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodedKey}`

    return NextResponse.json({ uploadUrl, publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}