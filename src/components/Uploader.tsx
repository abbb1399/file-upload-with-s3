/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

export function Uploader() {
  const [files, setFiles] = useState<
    Array<{
      id: string;
      file: File;
      uploading: boolean;
      progress: number;
      key?: string;
      isDeleting: boolean;
      error: boolean;
      objectUrl?: string;
    }>
  >([]);

  const uploadFile = async (file: File) => {
    setFiles((prevFiles) =>
      prevFiles.map((f) => (f.file === file ? { ...f, uploading: true } : f))
    );

    try {
      // 1. presigned URL 얻기
      const presignedResponse = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!presignedResponse.ok) {
        toast.error("presigned URL 얻기 실패");

        setFiles((prevFiles) =>
          prevFiles.map((f) =>
            f.file === file
              ? { ...f, uploading: false, progress: 0, error: true }
              : f
          )
        );

        return;
      }

      const { presignedUrl, key } = await presignedResponse.json();

      // 2. S3에 파일 업로드
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setFiles((prevFiles) =>
              prevFiles.map((f) =>
                f.file === file
                  ? { ...f, progress: Math.round(percentComplete), key: key }
                  : f
              )
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            // 3. 파일 업로드 완료 - 진행률을 100%로 설정
            setFiles((prevFiles) =>
              prevFiles.map((f) =>
                f.file === file
                  ? { ...f, progress: 100, uploading: false, error: false }
                  : f
              )
            );

            toast.success("파일 업로드 성공");

            resolve();
          } else {
            reject(new Error(`파일 업로드 실패: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("파일 업로드 실패"));
        };

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
    } catch {
      toast.error("파일 업로드 실패");

      setFiles((prevFiles) =>
        prevFiles.map((f) =>
          f.file === file
            ? { ...f, uploading: false, progress: 0, error: true }
            : f
        )
      );
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFiles((prevFiles) => [
        ...prevFiles,
        ...acceptedFiles.map((file) => ({
          id: uuidv4(),
          file,
          uploading: false,
          progress: 0,
          isDeleting: false,
          error: false,
          objectUrl: URL.createObjectURL(file),
        })),
      ]);

      try {
      } catch {}
    }

    acceptedFiles.forEach(uploadFile);
  }, []);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      const tooManyFiles = fileRejections.find(
        (fileRejections) => fileRejections.errors[0].code === "too-many-files"
      );

      const fileTooLarge = fileRejections.find(
        (fileRejections) => fileRejections.errors[0].code === "file-too-large"
      );

      if (tooManyFiles) {
        toast.error("한번에 5개만 업로드 할 수 있습니다.");
      }

      if (fileTooLarge) {
        toast.error("파일 크기가 너무 큽니다.");
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    maxFiles: 5,
    maxSize: 1024 * 1024 * 5,
    accept: {
      "image/*": [],
    },
  });

  return (
    <>
      <Card
        className={cn(
          "relative border-2 border-dashed transition-colors duration-200 ease-in-out w-full h-64",
          isDragActive
            ? "border-primary bg-primary/10 border-solid"
            : "border-border hover:border-primary"
        )}
        {...getRootProps()}
      >
        <CardContent className="flex flex-col items-center justify-center h-full w-full">
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>
              파일을 여기에 드래그 앤 드롭하거나 클릭하여 파일을 선택하세요.
            </p>
          ) : (
            <div className="flex flex-col items-center justify-center h-full w-full gap-y-3">
              <p>
                파일을 여기에 드래그 앤 드롭하거나 클릭하여 파일을 선택하세요.
              </p>
              <Button>파일 선택</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mt-6">
        {files.map((file) => (
          <div key={file.id} className="flex flex-col gap-1">
            <div className="relative aspect-square rounded-lg overflow-hidden">
              <img
                src={file.objectUrl}
                alt={file.file.name}
                className="w-full h-full object-cover"
              />

              {file.uploading && !file.isDeleting && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <p className="text-white font-medium text-lg">
                    {file.progress}%
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
