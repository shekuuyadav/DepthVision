"use client";

import React, { useState, useRef, useCallback, ChangeEvent } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { generateDepthMap } from '@/ai/flows/depth-map-generation';
import type { GenerateDepthMapInput } from '@/ai/flows/depth-map-generation';
import { fetchImageAsDataUrl } from '@/actions/image-proxy';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, LinkIcon, Loader2, Eraser, Eye, AlertTriangle } from 'lucide-react';

const ThreeDeeCanvas = dynamic(() => import('@/components/depth-vision/ThreeDeeCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full min-h-[300px] lg:min-h-[500px] bg-muted/50 rounded-lg">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="ml-4 text-muted-foreground">Loading 3D Viewer...</p>
    </div>
  ),
});

export default function DepthVisionPage() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [depthMapImage, setDepthMapImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Error", description: "File size exceeds 5MB limit.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImage(e.target?.result as string);
        setDepthMapImage(null); // Clear previous depth map
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUrlLoad = async () => {
    if (!imageUrl) {
      toast({ title: "Error", description: "Please enter an image URL.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setProgress(30);
    setError(null);
    try {
      const result = await fetchImageAsDataUrl(imageUrl);
      if (result.success) {
        setOriginalImage(result.dataUri);
        setDepthMapImage(null);
      } else {
        setError(result.error);
        toast({ title: "Error loading image from URL", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      setError("Failed to load image from URL.");
      toast({ title: "Error", description: e.message || "Failed to load image from URL.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handleGenerateDepthMap = async () => {
    if (!originalImage) {
      toast({ title: "Error", description: "Please upload an image first.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setProgress(10); // Initial progress
    setError(null);
    setDepthMapImage(null);

    try {
      // Simulate progress for AI generation
      const progressInterval = setInterval(() => {
        setProgress(p => (p < 90 ? p + 10 : p));
      }, 500);

      const input: GenerateDepthMapInput = { photoDataUri: originalImage };
      const result = await generateDepthMap(input);
      
      clearInterval(progressInterval);
      setProgress(100);

      if (result.depthMapDataUri) {
        setDepthMapImage(result.depthMapDataUri);
        toast({ title: "Success", description: "Depth map generated successfully!" });
      } else {
        throw new Error("AI did not return a depth map.");
      }
    } catch (e: any) {
      console.error("Error generating depth map:", e);
      setError(e.message || "Failed to generate depth map.");
      toast({ title: "Error generating depth map", description: e.message || "An unknown error occurred.", variant: "destructive" });
      clearInterval(progressInterval); // Ensure interval is cleared on error
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handleClear = () => {
    setOriginalImage(null);
    setDepthMapImage(null);
    setImageUrl('');
    setError(null);
    setIsLoading(false);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
    }
    toast({ title: "Cleared", description: "Inputs and 3D view have been cleared." });
  };

  const handleExportLoadingChange = useCallback((loading: boolean) => {
    setIsExporting(loading);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8 font-body">
      <header className="mb-6 md:mb-10 text-center">
        <div className="inline-flex items-center justify-center space-x-3">
          <Eye className="h-12 w-12 text-primary" />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-bold text-primary">DepthVision</h1>
        </div>
        <p className="text-muted-foreground mt-2 md:mt-3 text-base md:text-lg lg:text-xl">
          Transform your 2D images into immersive 3D views.
        </p>
      </header>

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        <Card className="lg:col-span-2 shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">1. Upload Image</CardTitle>
            <CardDescription>Choose an image from your device or load from a URL.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload File
                </TabsTrigger>
                <TabsTrigger value="url">
                  <LinkIcon className="mr-2 h-4 w-4" /> From URL
                </TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-6">
                <div className="space-y-2">
                  <Label htmlFor="file-upload" className="text-base">Select Image File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">Max file size: 5MB. Supported: PNG, JPG, WEBP, GIF.</p>
                </div>
              </TabsContent>
              <TabsContent value="url" className="mt-6">
                <div className="space-y-2">
                  <Label htmlFor="image-url" className="text-base">Image URL</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="image-url"
                      type="url"
                      placeholder="https://example.com/image.png"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-grow"
                      disabled={isLoading}
                    />
                    <Button onClick={handleImageUrlLoad} disabled={isLoading || !imageUrl.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      {isLoading && !originalImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Load
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {originalImage && (
              <div className="mt-6 space-y-2">
                <h3 className="text-lg font-medium text-primary">Original Image Preview:</h3>
                <div className="relative aspect-video w-full max-w-md mx-auto rounded-lg overflow-hidden border shadow-sm">
                  <Image src={originalImage} alt="Original preview" layout="fill" objectFit="contain" data-ai-hint="user uploaded content"/>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t">
            <Button onClick={handleClear} variant="outline" disabled={isLoading || isExporting} className="w-full sm:w-auto">
              <Eraser className="mr-2 h-4 w-4" /> Clear All
            </Button>
            <Button 
              onClick={handleGenerateDepthMap} 
              disabled={!originalImage || isLoading || isExporting} 
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading && !depthMapImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" /> }
              Generate 3D View
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-3 shadow-xl rounded-xl flex flex-col min-h-[400px] lg:min-h-[600px]">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">2. Explore in 3D</CardTitle>
            <CardDescription>Interact with the generated 3D model. Use mouse/touch to rotate and zoom.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow relative p-0 overflow-hidden rounded-b-xl">
            {(isLoading && progress > 0) && (
              <div className="absolute top-0 left-0 right-0 z-20">
                <Progress value={progress} className="w-full h-1.5 rounded-none" />
                 <p className="text-xs text-center text-primary py-0.5 bg-primary/10">Processing... {progress}%</p>
              </div>
            )}
            <ThreeDeeCanvas originalImageUri={originalImage} depthMapUri={depthMapImage} onExportLoadingChange={handleExportLoadingChange} />
            {isExporting && (
               <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
                 <Loader2 className="w-12 h-12 text-primary animate-spin" />
                 <p className="ml-4 text-primary font-medium">Exporting video...</p>
               </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="text-center mt-8 md:mt-12 py-4 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} DepthVision. All rights reserved.</p>
      </footer>
    </div>
  );
}
