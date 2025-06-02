
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RecordRTC from 'recordrtc';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Camera, Download, Video, ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';

interface ThreeDeeCanvasProps {
  originalImageUri: string | null;
  depthMapUri: string | null;
  onExportLoadingChange?: (isLoading: boolean) => void;
}

const ThreeDeeCanvas: React.FC<ThreeDeeCanvasProps> = ({ originalImageUri, depthMapUri, onExportLoadingChange }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);

  const [aspectRatio, setAspectRatio] = useState(16/9);

  const cleanupScene = useCallback(() => {
    if (meshRef.current && sceneRef.current) {
      sceneRef.current.remove(meshRef.current);
      if (meshRef.current.geometry) meshRef.current.geometry.dispose();
      if (meshRef.current.material) {
        const material = meshRef.current.material as THREE.MeshStandardMaterial;
        if (material.map) material.map.dispose();
        if (material.displacementMap) material.displacementMap.dispose();
        material.dispose();
      }
      meshRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    if (!originalImageUri || !depthMapUri) {
      cleanupScene(); // Clean up if images are removed
      if(rendererRef.current && sceneRef.current && cameraRef.current) { // Clear canvas
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      return;
    }

    setIsLoadingAssets(true);
    const currentMount = mountRef.current;

    // Initialize scene, camera, renderer if they don't exist
    if (!rendererRef.current) {
      sceneRef.current = new THREE.Scene();
      sceneRef.current.background = new THREE.Color(0xf0f4f8); // Match app background

      cameraRef.current = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
      cameraRef.current.position.z = 1.5;

      rendererRef.current = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      currentMount.appendChild(rendererRef.current.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      sceneRef.current.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      sceneRef.current.add(directionalLight);

      controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.05;
    } else {
      // Ensure renderer size is up-to-date
      rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
      if(cameraRef.current) {
        cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
        cameraRef.current.updateProjectionMatrix();
      }
    }
    
    cleanupScene();

    const textureLoader = new THREE.TextureLoader();
    Promise.all([
      textureLoader.loadAsync(originalImageUri),
      textureLoader.loadAsync(depthMapUri),
    ]).then(([originalTexture, depthTexture]) => {
      const imageAspect = originalTexture.image.width / originalTexture.image.height;
      setAspectRatio(imageAspect);

      const planeWidth = 2; // Arbitrary width
      const planeHeight = planeWidth / imageAspect;
      
      const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 255, Math.round(255 / imageAspect));
      const material = new THREE.MeshStandardMaterial({
        map: originalTexture,
        displacementMap: depthTexture,
        displacementScale: 0.3, // Adjust for desired depth effect
        // displacementBias: -0.15, // May need adjustment
        side: THREE.DoubleSide, // Render both sides
      });
      meshRef.current = new THREE.Mesh(geometry, material);
      sceneRef.current!.add(meshRef.current);
      
      // Adjust camera to fit plane
      if (cameraRef.current) {
        const fov = cameraRef.current.fov * (Math.PI / 180);
        const distance = Math.max(planeWidth, planeHeight) / (2 * Math.tan(fov / 2)) * 1.1; // 1.1 for a bit of margin
        cameraRef.current.position.z = distance;
        controlsRef.current?.target.set(0,0,0);
        controlsRef.current?.update();
      }

      setIsLoadingAssets(false);
    }).catch(error => {
      console.error("Error loading textures:", error);
      setIsLoadingAssets(false);
    });

    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;
      requestAnimationFrame(animate);
      controlsRef.current.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    animate();

    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current || !currentMount) return;
      rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
      cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      // Full cleanup if component unmounts, partial if just images change (handled by cleanupScene)
      // For full unmount:
      // if (rendererRef.current) {
      //   currentMount.removeChild(rendererRef.current.domElement);
      //   rendererRef.current.dispose();
      //   rendererRef.current = null;
      // }
      // controlsRef.current?.dispose();
      // controlsRef.current = null;
      // sceneRef.current = null;
      // cameraRef.current = null;
    };
  }, [originalImageUri, depthMapUri, cleanupScene]);

  const setPresetView = (preset: 'front' | 'top' | 'sideR' | 'sideL' | 'reset') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const distance = cameraRef.current.position.length();
    controlsRef.current.reset(); // Resets target to 0,0,0 and position

    switch (preset) {
      case 'front':
      case 'reset':
        cameraRef.current.position.set(0, 0, distance > 0.1 ? distance : 1.5);
        break;
      case 'top':
        cameraRef.current.position.set(0, distance > 0.1 ? distance : 1.5, 0.001); // slight offset to avoid gimbal lock issue with lookAt(0,0,0)
        break;
      case 'sideR':
        cameraRef.current.position.set(distance > 0.1 ? distance : 1.5, 0, 0);
        break;
      case 'sideL':
        cameraRef.current.position.set(-(distance > 0.1 ? distance : 1.5), 0, 0);
        break;
    }
    cameraRef.current.lookAt(0,0,0);
    controlsRef.current.update();
  };

  const handleZoom = (factor: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    if (cameraRef.current instanceof THREE.PerspectiveCamera) {
        // Perspective camera zoom is FOV or dolly
        // Dolly for OrbitControls is better
        controlsRef.current.dollyOut(factor); // factor > 1 zooms in, < 1 zooms out. So use 1.2 for zoom in, 0.8 for zoom out.
        controlsRef.current.update();
    }
  };

  const exportAsImage = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'depthvision_render.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const startRecording = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    onExportLoadingChange?.(true);
    setIsRecording(true);
    const canvas = rendererRef.current.domElement;
    const stream = canvas.captureStream(30); // 30 FPS
    
    recorderRef.current = new RecordRTC(stream, {
      type: 'video',
      mimeType: 'video/webm;codecs=vp9',
      bitsPerSecond: 2500 * 1000, // 2.5 Mbps
    });
    recorderRef.current.startRecording();

    // Simple animation: rotate around Y axis
    const initialRotationY = meshRef.current ? meshRef.current.rotation.y : 0;
    const startTime = Date.now();
    const duration = 5000; // 5 seconds

    const animateRecording = () => {
      if (!recorderRef.current || !recorderRef.current.getState().includes('recording')) return;
      
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < duration) {
        if (meshRef.current) {
          meshRef.current.rotation.y = initialRotationY + (elapsedTime / duration) * Math.PI * 2; // One full rotation
        }
        requestAnimationFrame(animateRecording);
      } else {
        stopRecordingAndDownload();
        if (meshRef.current) meshRef.current.rotation.y = initialRotationY; // Reset rotation
      }
    };
    animateRecording();
  };

  const stopRecordingAndDownload = () => {
    if (recorderRef.current) {
      recorderRef.current.stopRecording(() => {
        const blob = recorderRef.current!.getBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'depthvision_animation.webm';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        recorderRef.current = null;
        setIsRecording(false);
        onExportLoadingChange?.(false);
      });
    } else {
        setIsRecording(false);
        onExportLoadingChange?.(false);
    }
  };
  
  const hasContent = originalImageUri && depthMapUri;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="absolute top-2 right-2 z-10 flex space-x-2 p-1 bg-card/50 backdrop-blur-sm rounded-md">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setPresetView('reset')} disabled={!hasContent || isRecording}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Reset View</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => handleZoom(1.2)} disabled={!hasContent || isRecording}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Zoom In</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => handleZoom(0.8)} disabled={!hasContent || isRecording}>
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Zoom Out</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setPresetView('top')} disabled={!hasContent || isRecording}>
                <Camera className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Top View</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={exportAsImage} disabled={!hasContent || isRecording}>
                <Download className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Download Screenshot (PNG)</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={startRecording} disabled={!hasContent || isRecording}>
                {isRecording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{isRecording ? "Recording..." : "Record Animation (WebM)"}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div ref={mountRef} className="flex-grow w-full h-full relative rounded-b-lg overflow-hidden">
        {isLoadingAssets && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        )}
        {!hasContent && !isLoadingAssets && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <p>3D view will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreeDeeCanvas;
