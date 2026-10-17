'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Upload, Loader2, Check } from '@/components/icons';
import { Flag, RelatedFlag } from '@/lib/types';
import { toast } from 'sonner';
import { createFlagRequest } from '@/actions/requests';
import { Textarea } from './ui/textarea';
import { blobUrlToBase64 } from '@/lib/blob-to-url';
import RelatedFlagInput from './related-flag-input';
import TagInput from './TagInput';
import SourcesInput from './SourcesInput';
import { getRelatedFlags } from '@/actions/flags';
import { useQuery } from '@tanstack/react-query';
import { toastErrorWithLogin } from '@/lib/toast-auth';

type FlagFieldsFormProps = {
  initialFlag: Omit<Flag, 'index'> & { index?: number };
  onCancel?: () => void;
};

export default function FlagFieldsForm({
  initialFlag,
  onCancel,
}: FlagFieldsFormProps) {
  const [flagName, setFlagName] = useState(initialFlag.flagName || '');
  const [description, setDescription] = useState(initialFlag.description || '');
  const [flagImage, setFlagImage] = useState(initialFlag.flagImage || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(initialFlag.flagImage || '');
  const [fileType, setFileType] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState('');
  const [relatedFlags, setRelatedFlags] = useState<RelatedFlag[]>(
    initialFlag.relatedFlags || [],
  );
  const [tags, setTags] = useState<string[]>(initialFlag.tags || []);
  const [sources, setSources] = useState<string[]>(initialFlag.sources || []);
  const [isLoading, setIsLoading] = useState(false);

  const { data: relatedFlagsData } = useQuery({
    queryKey: ['recommendations', initialFlag.id],
    queryFn: () => getRelatedFlags(initialFlag.id),
  });

  useEffect(() => {
    if (relatedFlagsData) {
      setRelatedFlags(relatedFlagsData);
    }
  }, [relatedFlagsData]);

  const handleAddRelatedFlag = (flag: RelatedFlag) => {
    setRelatedFlags([...relatedFlags, flag]);
  };

  const handleRemoveRelatedFlag = (id: string) => {
    setRelatedFlags(relatedFlags.filter((f) => f.id !== id));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setFileType(file.type);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setFlagImage(url);
      setImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setFileType(file.type);
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setFlagImage(url);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFlagImage(url);
    if (url.trim()) {
      setPreviewUrl(url);
      setImageFile(null);
    } else {
      setPreviewUrl('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const flag = {
        flagName: flagName,
        flagImage: flagImage || imageFile?.name || '',
        link: '', // Keeping empty for backward compatibility
        description: description,
        relatedFlags: relatedFlags,
        tags: tags,
        sources: sources,
      };
      if (sources.length === 0) {
        alert('Please add at least one source');
        setIsLoading(false);
        return;
      }
      if (flag.flagImage.startsWith('blob:')) {
        const contentType = fileType || 'image/jpeg';
        flag.flagImage = await blobUrlToBase64(flag.flagImage, contentType);
      }

      const result = await createFlagRequest(flag, initialFlag.id, userMessage);
      if (result.success) {
        toast.success(
          result.autoApproved
            ? 'Flag updated!'
            : 'Flag update request sent! Please wait for approval.',
        );
      } else {
        toastErrorWithLogin(result.message);
      }
      if (onCancel) {
        onCancel();
      }
    } catch (error) {
      console.error(error);
      toast.error('An error occurred while posting the flag.');
    } finally {
      setIsLoading(false);
    }
  };

  const isChangeMade = useMemo(() => {
    return (
      flagName !== initialFlag.flagName ||
      description !== initialFlag.description ||
      flagImage !== initialFlag.flagImage ||
      JSON.stringify(relatedFlags) !==
        JSON.stringify(initialFlag.relatedFlags) ||
      JSON.stringify(tags) !== JSON.stringify(initialFlag.tags) ||
      JSON.stringify(sources) !== JSON.stringify(initialFlag.sources)
    );
  }, [
    flagName,
    description,
    flagImage,
    initialFlag.flagName,
    initialFlag.description,
    initialFlag.flagImage,
    initialFlag.relatedFlags,
    initialFlag.tags,
    initialFlag.sources,
    relatedFlags,
    tags,
    sources,
  ]);

  return (
    <form
      onSubmit={handleSubmit}
      className='grid w-full items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'
    >
      <div className='grid gap-4'>
        <FormSection title='Details'>
          <div className='space-y-1.5'>
            <label htmlFor='flagName' className='block text-[13px] font-medium'>
              Name
            </label>
            <Input
              autoFocus
              id='flagName'
              placeholder='Flag name'
              className='w-full'
              value={flagName}
              onChange={(e) => setFlagName(e.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <label
              htmlFor='description'
              className='block text-[13px] font-medium'
            >
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              id='description'
              className='min-h-[140px]'
              placeholder='Describe the flag, its history, or any interesting facts...'
            />
          </div>
          <TagInput tags={tags} onTagsChange={setTags} />
          <SourcesInput sources={sources} onSourcesChange={setSources} />
        </FormSection>
        <FormSection title='Note for moderators'>
          <Textarea
            id='userMessage'
            aria-label='Note for moderators'
            placeholder='Anything the moderators should know about this edit?'
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            className='w-full'
          />
        </FormSection>
      </div>

      <div className='grid gap-4'>
        <FormSection title='Image'>
          <div className='grid h-[188px] place-items-center rounded-[14px] bg-stage p-4'>
            {previewUrl ? (
              <Image
                width={320}
                height={200}
                src={previewUrl}
                alt='Flag preview'
                className='max-h-[150px] w-auto max-w-full object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.18)]'
                onError={() => setPreviewUrl('')}
              />
            ) : (
              <span className='text-[13px] text-muted-foreground'>
                No image
              </span>
            )}
          </div>
          <div
            className='vx-well flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-border px-4 py-5 text-center sm:flex-row sm:text-left'
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <Upload className='size-5 shrink-0 text-muted-foreground' />
            <div className='min-w-0 flex-1'>
              {imageFile ? (
                <p
                  className='flex items-center justify-center gap-1.5 truncate text-[13px] font-medium text-good sm:justify-start'
                  title={imageFile.name}
                >
                  <Check className='size-3.5 shrink-0' />
                  <span className='truncate'>{imageFile.name}</span>
                </p>
              ) : (
                <p className='text-[13px] text-muted-foreground'>
                  Drop an image here to replace it
                </p>
              )}
            </div>
            <input
              type='file'
              id='file-upload'
              accept='image/*,.svg'
              onChange={handleImageChange}
              className='hidden'
            />
            <Button variant='neutral' size='sm' asChild>
              <label htmlFor='file-upload' className='shrink-0'>
                Choose file
              </label>
            </Button>
          </div>
          <div className='space-y-1.5'>
            <label
              htmlFor='flagImage'
              className='block text-[13px] font-medium'
            >
              Image URL
            </label>
            <Input
              id='flagImage'
              placeholder='https://…'
              value={flagImage}
              onChange={handleImageUrlChange}
              className='w-full'
            />
          </div>
        </FormSection>

        <FormSection title='Related flags'>
          <RelatedFlagInput
            relatedFlags={relatedFlags}
            onAdd={handleAddRelatedFlag}
            onRemove={handleRemoveRelatedFlag}
          />
        </FormSection>
      </div>

      <div className='flex justify-end gap-2 border-t border-line pt-4 lg:col-span-2'>
        {onCancel && (
          <Button variant='neutral' type='button' onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type='submit'
          disabled={!isChangeMade || isLoading}
          className='min-w-[120px]'
        >
          {isLoading && <Loader2 className='animate-spin' />}
          {isLoading ? 'Saving' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

/** Tile on a page; flattens to a plain group when rendered inside a dialog (already a tile). */
function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className='vx-tile space-y-4 px-[22px] py-5 in-data-[slot=dialog-content]:p-0 in-data-[slot=dialog-content]:[background:none] in-data-[slot=dialog-content]:shadow-none'>
      <h2 className='text-sm font-semibold tracking-[-0.01em]'>{title}</h2>
      {children}
    </section>
  );
}
