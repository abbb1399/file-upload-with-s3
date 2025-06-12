import { Uploader } from "@/components/Uploader";

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto flex min-h-screen flex-col items-center justify-center ">
      <h1 className="text-4xl font-bold pb-10">S3에 파일 업로드하기 📂</h1>
      <Uploader />
    </div>
  );
}
