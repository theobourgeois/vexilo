import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/icons';
import { RemovablePill } from './TagInput';

type SourcesInputProps = {
  sources: string[];
  onSourcesChange: (sources: string[]) => void;
  placeholder?: string;
  label?: string;
};

export default function SourcesInput({
  sources,
  onSourcesChange,
  placeholder = 'https://…',
  label = 'Sources',
}: SourcesInputProps) {
  const [inputValue, setInputValue] = useState('');

  const validateUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const addSource = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !sources.includes(trimmedValue)) {
      if (!validateUrl(trimmedValue)) {
        alert('URL must start with http:// or https://');
        return;
      }
      onSourcesChange([...sources, trimmedValue]);
      setInputValue('');
    }
  };

  const removeSource = (sourceToRemove: string) => {
    const newSources = sources.filter((source) => source !== sourceToRemove);
    onSourcesChange(newSources);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSource();
    }
  };

  return (
    <div className='space-y-1.5'>
      <label htmlFor='sources' className='block text-[13px] font-medium'>
        {label}
      </label>
      <div className='flex gap-2'>
        <Input
          id='sources'
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className='flex-1'
        />
        <Button
          type='button'
          variant='neutral'
          onClick={addSource}
          disabled={!inputValue.trim()}
          className='h-10'
        >
          <Plus />
          Add
        </Button>
      </div>
      {sources.length === 0 ? (
        <p className='text-xs text-muted-foreground'>
          Paste a link and press Enter. At least one source is required.
        </p>
      ) : (
        <div className='flex flex-wrap gap-1.5 pt-1'>
          {sources.map((source) => (
            <RemovablePill
              key={source}
              title={source}
              onRemove={() => removeSource(source)}
              removeLabel={`Remove source ${source}`}
              className='max-w-[320px]'
            >
              <span className='truncate'>{source.replace(/^https?:\/\/(www\.)?/, '')}</span>
            </RemovablePill>
          ))}
        </div>
      )}
    </div>
  );
}
