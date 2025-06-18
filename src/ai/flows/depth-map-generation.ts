
'use server';

/**
 * @fileOverview Generates a depth map from an image using AI.
 *
 * - generateDepthMap - A function that generates a depth map from an image.
 * - GenerateDepthMapInput - The input type for the generateDepthMap function.
 * - GenerateDepthMapOutput - The return type for the generateDepthMap function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDepthMapInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo to generate a depth map from, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Per GenKit requirements.
    ),
});
export type GenerateDepthMapInput = z.infer<typeof GenerateDepthMapInputSchema>;

const GenerateDepthMapOutputSchema = z.object({
  depthMapDataUri: z
    .string()
    .describe(
      'The generated depth map as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Per GenKit requirements.
    ),
});
export type GenerateDepthMapOutput = z.infer<typeof GenerateDepthMapOutputSchema>;

export async function generateDepthMap(input: GenerateDepthMapInput): Promise<GenerateDepthMapOutput> {
  return generateDepthMapFlow(input);
}

const depthMapPrompt = ai.definePrompt({
  name: 'depthMapPrompt',
  input: {schema: GenerateDepthMapInputSchema},
  output: {schema: GenerateDepthMapOutputSchema},
  prompt: [
    {media: {url: '{{{photoDataUri}}}'}},
    {
      text:
        'Generate a very high-quality, precise, and detailed depth map for the image provided. The depth map must be grayscale. Lighter shades (closer to white) must represent objects nearer to the camera, and darker shades (closer to black) must represent objects farther away. Ensure smooth transitions in depth where appropriate, but maintain sharp and accurate edges for distinct objects. The depth map should accurately capture the spatial relationships and three-dimensional structure of the scene. Return the resulting depth map as a data URI with MIME type and base64 encoding.',
    },
  ],
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
  },
});

const generateDepthMapFlow = ai.defineFlow(
  {
    name: 'generateDepthMapFlow',
    inputSchema: GenerateDepthMapInputSchema,
    outputSchema: GenerateDepthMapOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      // IMPORTANT: ONLY the googleai/gemini-2.0-flash-exp model is able to generate images. You MUST use exactly this model to generate images.
      model: 'googleai/gemini-2.0-flash-exp',

      prompt: [
        {media: {url: input.photoDataUri}},
        {text: 'Generate a very high-quality, precise, and detailed depth map for the image provided. The depth map must be grayscale. Lighter shades (closer to white) must represent objects nearer to the camera, and darker shades (closer to black) must represent objects farther away. Ensure smooth transitions in depth where appropriate, but maintain sharp and accurate edges for distinct objects. The depth map should accurately capture the spatial relationships and three-dimensional structure of the scene. Return the resulting depth map as a data URI with MIME type and base64 encoding.'},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE, IMAGE only won't work
      },
    });

    return {depthMapDataUri: media.url!};
  }
);

