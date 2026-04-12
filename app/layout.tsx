import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DataHubProvider } from "@/lib/data-hub-context";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ozon rFBS 跨境精算系统",
  description: "精准还原真实利润、智能推荐防亏损阶梯定价、自动筛选最优物流",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} antialiased`}>
        <DataHubProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </DataHubProvider>
      </body>
    </html>
  );
}