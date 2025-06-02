"use server";

export async function fetchImageAsDataUrl(imageUrl: string): Promise<{ success: true, dataUri: string } | { success: false, error: string }> {
  try {
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return { success: false, error: 'Invalid URL. Must start with http:// or https://' };
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'DepthVision/1.0 (+https://your-app-domain.com/bot-info)' // Be a good internet citizen
      },
      redirect: 'follow', // Follow redirects
      signal: AbortSignal.timeout(10000), // Timeout after 10 seconds
    });

    if (!response.ok) {
      return { success: false, error: `Failed to fetch image: ${response.status} ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return { success: false, error: 'URL does not point to a valid image type. Received: ' + contentType };
    }

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedImageTypes.includes(contentType.toLowerCase())) {
        return { success: false, error: `Unsupported image type: ${contentType}. Supported types are JPEG, PNG, GIF, WebP, SVG.` };
    }
    
    const buffer = await response.arrayBuffer();
    // Limit file size to 10MB
    if (buffer.byteLength > 10 * 1024 * 1024) {
        return { success: false, error: 'Image size exceeds 10MB limit.' };
    }
    const base64 = Buffer.from(buffer).toString('base64');
    return { success: true, dataUri: `data:${contentType};base64,${base64}` };

  } catch (error) {
    console.error("Error fetching image from URL:", error);
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timed out')) {
        return { success: false, error: 'Failed to load image: Request timed out.'}
      }
      return { success: false, error: `Failed to load image from URL: ${error.message}` };
    }
    return { success: false, error: "An unknown error occurred while fetching the image." };
  }
}
