export async function blobUrlToBase64(blobUrl: string, contentType: string): Promise<string> {
  const response = await fetch(blobUrl);

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = `data:${contentType};base64,${base64String.split(",")[1]}`;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}