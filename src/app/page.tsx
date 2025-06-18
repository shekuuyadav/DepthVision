
"use client";

import React, { useState, useRef, useCallback, ChangeEvent, DragEvent, useEffect, KeyboardEvent } from 'react';
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
import { UploadCloud, LinkIcon, Loader2, Eraser, Eye, AlertTriangle, FileImage, XIcon, RefreshCw, Expand } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

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
  const [originalImage, setOriginalImage] = useState<string | null>(null); // Stores data URI for image or video
  const [depthMapImage, setDepthMapImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);
  const [isThreeDeeFullscreen, setIsThreeDeeFullscreen] = useState(false);


  const { toast } = useToast();

  const processFile = (file: File | null) => {
    if (file) {
      const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      const acceptedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']; // Added MOV
      const acceptedTypes = [...acceptedImageTypes, ...acceptedVideoTypes];

      if (!acceptedTypes.includes(file.type.toLowerCase())) { // toLowerCase for consistency
        toast({ title: "Error", description: "Invalid file type. Please upload an image (PNG, JPG, WEBP, GIF) or video (MP4, WEBM, MOV).", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // Increased to 10MB for potential video files
        toast({ title: "Error", description: "File size exceeds 10MB limit.", variant: "destructive" });
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
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    processFile(event.target.files?.[0] ?? null);
  };

  const handleImageUrlLoad = async () => {
    if (!imageUrl || !imageUrl.trim()) {
      toast({ title: "Error", description: "Please enter an image URL.", variant: "destructive" });
      return;
    }
    if (!imageUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        toast({ title: "Info", description: "Loading from URL currently only supports image files (JPEG, PNG, GIF, WEBP). Video URL support is not yet available.", variant: "default" });
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

  const handleUrlInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleImageUrlLoad();
    }
  };

  const handleGenerateDepthMap = async () => {
    if (!originalImage) {
      toast({ title: "Error", description: "Please upload an image or video first.", variant: "destructive" });
      return;
    }

    if (originalImage.startsWith('data:video')) {
        toast({
            title: "Feature Coming Soon",
            description: "Generating depth maps from video frames is not yet supported. Please select an image to generate a 3D view.",
            variant: "default"
        });
        return;
    }

    setIsLoading(true);
    setProgress(10);
    setError(null);
    setDepthMapImage(null);
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      progressInterval = setInterval(() => {
        setProgress(p => (p < 90 ? p + 10 : p));
      }, 500);

      const input: GenerateDepthMapInput = { photoDataUri: originalImage };
      const result = await generateDepthMap(input);

      if (progressInterval) clearInterval(progressInterval);
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
      if (progressInterval) clearInterval(progressInterval);
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
      fileInputRef.current.value = '';
    }
    toast({ title: "Cleared", description: "Inputs and 3D view have been cleared." });
  };

  const handleExportLoadingChange = useCallback((loading: boolean) => {
    setIsExporting(loading);
  }, []);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
      event.dataTransfer.clearData();
    }
  };

  const toggleImageFullscreen = () => {
    if (originalImage && originalImage.startsWith('data:image')) {
      setIsImageFullscreen(!isImageFullscreen);
    }
  };
  
  const toggleThreeDeeFullscreen = () => {
    if (originalImage && depthMapImage) {
      setIsThreeDeeFullscreen(!isThreeDeeFullscreen);
    } else {
      toast({
        title: "No 3D View Available",
        description: "Please upload an image and generate the 3D view first.",
        variant: "default",
      });
    }
  };


  useEffect(() => {
    const body = document.body;
    if (isImageFullscreen || isThreeDeeFullscreen) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = 'auto';
    }
    return () => {
      body.style.overflow = 'auto'; // Cleanup on unmount
    };
  }, [isImageFullscreen, isThreeDeeFullscreen]);


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8 font-body">
      <header className="mb-6 md:mb-10 text-center">
        <div className="inline-flex items-center justify-center space-x-3">
          <Eye className="h-12 w-12 text-primary" />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-bold text-primary">DepthVision</h1>
        </div>
        <p className="text-muted-foreground mt-2 md:mt-3 text-base md:text-lg lg:text-xl">
          Transform your 2D images and video frames into immersive 3D views.
        </p>
      </header>

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        <Card className="lg:col-span-2 shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-primary">1. Upload Media</CardTitle>
            <CardDescription>Choose an image or video, drag & drop, or load an image from a URL.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload / Drag
                </TabsTrigger>
                <TabsTrigger value="url">
                  <LinkIcon className="mr-2 h-4 w-4" /> From URL
                </TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-6">
                <div
                  className={cn(
                    "space-y-2 border-2 border-dashed rounded-lg p-6 transition-colors",
                    isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                    isLoading ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  <Label htmlFor="file-upload" className={cn("text-base font-medium flex flex-col items-center justify-center space-y-2", isLoading ? "cursor-not-allowed" : "cursor-pointer")}>
                    <FileImage className={cn("w-12 h-12", isDragging ? "text-primary" : "text-muted-foreground")} />
                    <span>{isDragging ? "Drop image or video here" : "Drag & drop image or video or click to select"}</span>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/gif, video/mp4, video/webm, video/quicktime"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="sr-only"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground text-center">Max file size: 10MB. Supported: PNG, JPG, WEBP, GIF, MP4, WEBM, MOV.</p>
                </div>
              </TabsContent>
              <TabsContent value="url" className="mt-6 space-y-4">
                <div className="flex space-x-2 items-center">
                  <Input
                    id="image-url"
                    type="url"
                    placeholder="Enter image URL"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={handleUrlInputKeyDown}
                    disabled={isLoading}
                    className="flex-grow"
                  />
                  <Button
                    onClick={handleImageUrlLoad}
                    disabled={isLoading || !imageUrl.trim()}
                    aria-label="Load image from URL"
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Load
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Note: URL loading currently supports image files only. Click Load or press Enter.</p>
              </TabsContent>
            </Tabs>

            {originalImage && (
              <div className="mt-6 space-y-2">
                <h3 className="text-lg font-medium text-primary">
                  {originalImage.startsWith('data:image') ? 'Original Image Preview:' : 'Original Video Preview:'}
                </h3>
                <div
                  className={cn(
                    "relative aspect-video w-full max-w-md mx-auto rounded-lg overflow-hidden border shadow-sm group",
                    originalImage.startsWith('data:image') ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
                  )}
                  onClick={originalImage.startsWith('data:image') ? toggleImageFullscreen : undefined}
                  role={originalImage.startsWith('data:image') ? "button" : undefined}
                  tabIndex={originalImage.startsWith('data:image') ? 0 : undefined}
                  onKeyDown={(e) => { if (originalImage.startsWith('data:image') && (e.key === 'Enter' || e.key === ' ')) toggleImageFullscreen();}}
                  aria-label={originalImage.startsWith('data:image') ? "View original image in fullscreen" : "Video preview"}
                >
                  {originalImage.startsWith('data:image') ? (
                    <Image
                      src={originalImage}
                      alt="Original preview"
                      layout="fill"
                      objectFit="contain"
                      data-ai-hint="user uploaded content"
                    />
                  ) : originalImage.startsWith('data:video') ? (
                    <video
                      src={originalImage}
                      controls
                      className="w-full h-full object-contain bg-black"
                      data-ai-hint="user uploaded video"
                    >
                        Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <p className="text-muted-foreground">Unsupported format for preview</p>
                    </div>
                  )}
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
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={handleClear} variant="outline" disabled={isLoading || isExporting} className="w-full sm:w-auto">
                <Eraser className="mr-2 h-4 w-4" /> Clear All
              </Button>
              <Button
                onClick={handleGenerateDepthMap}
                variant="outline"
                disabled={!originalImage || isLoading || isExporting || (originalImage !== null && originalImage.startsWith('data:video'))}
                className="w-full sm:w-auto"
                title={originalImage && originalImage.startsWith('data:video') ? "Video processing coming soon" : "Regenerate 3D view"}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
              </Button>
            </div>
            <Button
              onClick={handleGenerateDepthMap}
              disabled={!originalImage || isLoading || isExporting || (originalImage !== null && originalImage.startsWith('data:video'))}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
              title={originalImage && originalImage.startsWith('data:video') ? "Video processing coming soon" : "Generate 3D view"}
            >
              {isLoading && !depthMapImage && originalImage && !originalImage.startsWith('data:video') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" /> }
              Generate 3D View
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-3 shadow-xl rounded-xl flex flex-col min-h-[400px] lg:min-h-[600px]">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-headline text-primary">2. Explore in 3D</CardTitle>
                <CardDescription>Interact with the generated 3D model. Use mouse/touch to rotate and zoom.</CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleThreeDeeFullscreen} disabled={!originalImage || !depthMapImage || isLoading || isExporting}>
                      <Expand className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View in fullscreen</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="flex-grow relative p-0 overflow-hidden rounded-b-xl">
            {(isLoading && progress > 0 && originalImage && !originalImage.startsWith('data:video')) && (
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

      {isImageFullscreen && originalImage && originalImage.startsWith('data:image') && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={toggleImageFullscreen}
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen image view"
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-[51]"
            onClick={(e) => { e.stopPropagation(); toggleImageFullscreen(); }}
            aria-label="Close fullscreen image"
          >
            <XIcon className="w-8 h-8" />
          </button>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={originalImage}
              alt="Original image fullscreen"
              width={1920}
              height={1080}
              style={{ objectFit: 'contain', maxWidth: '90vw', maxHeight: '90vh' }}
              className="rounded-lg shadow-2xl"
              data-ai-hint="user uploaded content fullscreen"
            />
          </div>
        </div>
      )}

      {isThreeDeeFullscreen && originalImage && depthMapImage && (
        <div
          className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen 3D view"
        >
          <div className="relative w-full h-full max-w-[98vw] max-h-[98vh] bg-card rounded-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-2 sm:p-3 border-b bg-card">
              <h3 className="text-lg font-medium text-primary">3D View</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); toggleThreeDeeFullscreen(); }}
                aria-label="Close fullscreen 3D view"
              >
                <XIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
            </div>
            <div className="flex-grow relative bg-muted/20">
              <ThreeDeeCanvas
                key={`fullscreen-canvas-${Date.now()}`} // Using Date.now() to ensure re-mount
                originalImageUri={originalImage}
                depthMapUri={depthMapImage}
                onExportLoadingChange={handleExportLoadingChange}
              />
            </div>
          </div>
        </div>
      )}


      <footer className="text-center mt-8 md:mt-12 py-4 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} DepthVision. All rights reserved.</p>
      </footer>
    </div>
  );
}

    