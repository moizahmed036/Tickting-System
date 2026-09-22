'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  File as GenericFile,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TicketAttachment, UserRole } from '@/lib/types';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface TicketAttachmentsProps {
  ticketId: number;
  readOnly?: boolean;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.log', '.txt', '.csv', '.json'];
const MAX_FILE_SIZE_MB = 10;

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return <ImageIcon className="h-5 w-5 text-sky-400" />;
  }
  if (['pdf'].includes(ext)) {
    return <FileText className="h-5 w-5 text-rose-400" />;
  }
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
  }
  if (['log', 'txt', 'json', 'yaml', 'yml'].includes(ext)) {
    return <FileCode className="h-5 w-5 text-amber-400" />;
  }
  return <GenericFile className="h-5 w-5 text-indigo-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function TicketAttachments({ ticketId, readOnly = false }: TicketAttachmentsProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const res = await api.getAttachments(ticketId);
      setAttachments(res.items);
    } catch (err: any) {
      console.warn('Failed to load attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [ticketId]);

  const handleFileUpload = async (file: File) => {
    const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Unsupported file type '${ext}'. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_FILE_SIZE_MB}MB size limit.`);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(`Uploading ${file.name}...`);
      const newAttachment = await api.uploadAttachment(ticketId, file);
      setAttachments((prev) => [newAttachment, ...prev]);
      toast.success(`Attached "${file.name}" successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (attachment: TicketAttachment) => {
    if (!confirm(`Are you sure you want to delete attachment "${attachment.filename}"?`)) {
      return;
    }

    try {
      await api.deleteAttachment(attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      toast.success(`Deleted attachment "${attachment.filename}".`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete attachment');
    }
  };

  const handleDownload = async (attachment: TicketAttachment) => {
    try {
      const token = api.getToken();
      const url = api.getAttachmentDownloadUrl(attachment.id);
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error('Failed to download file.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      {!readOnly && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer text-center',
            dragActive
              ? 'border-primary bg-primary/10 ring-2 ring-primary/40'
              : 'border-border bg-card/40 hover:border-primary/50 hover:bg-card/70',
            uploading && 'pointer-events-none opacity-70'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 mb-3 group-hover:scale-105 transition-transform">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <UploadCloud className="h-6 w-6" />
            )}
          </div>

          <h4 className="text-sm font-semibold text-foreground">
            {uploading ? uploadProgress : 'Click or Drag & Drop evidence files here'}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Upload diagnostic logs, invoices, screenshots, or receipts (Max {MAX_FILE_SIZE_MB}MB per file).
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            {ALLOWED_EXTENSIONS.map((ext) => (
              <span
                key={ext}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border"
              >
                {ext}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Attachments List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">Attached Documents & Media</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {attachments.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Encrypted at rest</span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading attachments...</span>
          </div>
        ) : attachments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
            <HardDrive className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs font-semibold text-foreground">No attachments uploaded yet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Upload invoices, server logs, or error screenshots to support this ticket.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attachments.map((att) => {
              const canDelete =
                !readOnly && (user?.role === 'ADMIN' || (user && att.uploader_id === user.id));

              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card/60 hover:bg-card hover:border-primary/40 transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted border border-border group-hover:scale-105 transition-transform">
                      {getFileIcon(att.filename)}
                    </div>

                    <div className="min-w-0">
                      <p
                        className="text-xs font-semibold text-foreground truncate cursor-pointer hover:underline"
                        title={att.filename}
                        onClick={() => handleDownload(att)}
                      >
                        {att.filename}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{formatFileSize(att.file_size)}</span>
                        <span>•</span>
                        <span>
                          {att.uploader?.full_name || 'Staff'} •{' '}
                          {new Date(att.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(att)}
                      title="Download file"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(att)}
                        title="Delete attachment"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
