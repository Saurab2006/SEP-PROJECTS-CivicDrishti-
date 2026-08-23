import * as faceapi from 'face-api.js';

let modelsLoaded = false;

// Loads the "trained brain" files from public/models. Only needs to run once.
export async function loadFaceModels() {
  if (modelsLoaded) return;
  const MODEL_URL = '/models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  modelsLoaded = true;
}

// Takes an <img> or <video> element, finds the face, and returns its
// "fingerprint" (128 numbers). Returns null if no face was found.
export async function getFaceDescriptor(imageOrVideoElement) {
  const detection = await faceapi
    .detectSingleFace(imageOrVideoElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return Array.from(detection.descriptor);
}

// Compares two fingerprints. Returns a distance: lower = more similar.
// Under ~0.6 is generally considered a match for face-api.js.
export function compareDescriptors(descriptorA, descriptorB) {
  if (!descriptorA || !descriptorB) return Infinity;
  const dA = new Float32Array(descriptorA);
  const dB = new Float32Array(descriptorB);
  return faceapi.euclideanDistance(dA, dB);
}

// Helper: loads a base64 data URL (like your citizenshipDoc) into an
// actual <img> element so face-api.js can read it.
export function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load that image'));
    img.src = dataUrl;
  });
}