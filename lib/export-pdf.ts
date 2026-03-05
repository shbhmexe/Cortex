interface ChatMessage {
    role: string;
    content: string;
    relevancy?: number;
    timestamp?: number;
}

export const exportChatToPDF = async (messages: ChatMessage[], sessionId: string) => {
    // Dynamic import to avoid SSR issues with browser-only library
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // --- Helper: Add New Page ---
    const checkPageBreak = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
            addPageHeader();
        }
    };

    const addPageHeader = () => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("CortEx Technical Research Report", margin, margin - 10);
        doc.text(`Session: ${sessionId}`, pageWidth - margin, margin - 10, { align: "right" });
        doc.line(margin, margin - 8, pageWidth - margin, margin - 8);
        yPos = margin;
    };

    // --- 1. Header Section ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text("CortEx", margin, yPos + 10);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Deep Research Assistant for Engineers", margin, yPos + 16);

    yPos += 30;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Research Summary Report", margin, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, yPos);
    doc.text(`Session ID: ${sessionId}`, margin, yPos + 5);

    yPos += 15;
    doc.setDrawColor(230);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 15;

    // --- 2. Messages Loop ---
    messages.forEach((msg, index) => {
        // --- Role Indicator ---
        checkPageBreak(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);

        if (msg.role === "user") {
            doc.setTextColor(70, 70, 70);
            doc.text("USER QUERY", margin, yPos);
        } else {
            doc.setTextColor(37, 99, 235);
            doc.text("CORTEX RESPONSE", margin, yPos);

            if (msg.relevancy) {
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`(Relevancy: ${msg.relevancy}%)`, margin + 40, yPos);
            }
        }
        yPos += 8;

        // --- Content ---
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30);

        // Simple markdown cleaning (removing some common tags for PDF clarity)
        const cleanContent = msg.content
            .replace(/!\[.*?\]\(.*?\)/g, "") // remove images
            .replace(/\[\[(.*?)\]\]/g, "[$1]"); // simplify citations

        const lines = doc.splitTextToSize(cleanContent, contentWidth);

        lines.forEach((line: string) => {
            checkPageBreak(6);
            doc.text(line, margin, yPos);
            yPos += 6;
        });

        yPos += 10;
        doc.setDrawColor(245);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 10;
    });

    // --- Footer (on every page) ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    // Save PDF
    doc.save(`CortEx_Research_${sessionId.slice(0, 8)}_${Date.now()}.pdf`);
};
