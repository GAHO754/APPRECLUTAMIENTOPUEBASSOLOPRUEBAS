export async function verificarTamañoYComprimir(blob, tipo = "ZIP", maxMB = 2) {
  const maxBytes = maxMB * 1024 * 1024;

  if (blob.size <= maxBytes) {
    return blob; // ✅ Ya está dentro del límite
  }

  console.warn(`⚠️ El archivo ${tipo} supera los ${maxMB}MB. Intentando comprimir...`);

  if (tipo === "ZIP") {
    // No se puede recomprimir un ZIP directamente, deberías recomprimir las imágenes antes de generarlo
    alert("⚠️ El ZIP es demasiado grande. Intenta reducir la calidad de las imágenes antes de generarlo.");
    return blob;
  }

  if (tipo === "PDF") {
    const pdf = new jsPDF();
    const entries = Object.entries(images);

    for (let i = 0; i < entries.length; i++) {
      const [docName, blob] = entries[i];
      const imageDataUrl = await blobToDataURL(blob);

      const imgProps = pdf.getImageProperties(imageDataUrl);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2 - 10;

      let drawWidth = imgProps.width;
      let drawHeight = imgProps.height;

      const widthRatio = maxWidth / drawWidth;
      const heightRatio = maxHeight / drawHeight;
      const scale = Math.min(widthRatio, heightRatio);

      drawWidth *= scale;
      drawHeight *= scale;

      const x = (pageWidth - drawWidth) / 2;
      const y = margin + 10;

      if (i > 0) pdf.addPage();
      pdf.setFontSize(12);
      pdf.setTextColor(40);
      pdf.text(docName, pageWidth / 2, margin, { align: "center" });

      // 🧪 Aquí reducimos la calidad visual a 0.7
      pdf.addImage(imageDataUrl, "JPEG", x, y, drawWidth, drawHeight, undefined, "FAST");
    }

    return pdf.output("blob");
  }

  return blob;
}
