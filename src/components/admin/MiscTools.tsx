'use client';

import { createAdminFlags, generateFlagOfTheDay } from '@/actions/flags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function MiscTools() {
  const queryClient = useQueryClient();

  const handleImportFlags = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const flags = JSON.parse(text);

          if (flags.length > 0) {
            toast.loading('Importing flags...');
            createAdminFlags(flags)
              .then(() => {
                toast.dismiss();
                toast.success('Flags imported successfully');
              })
              .catch((error) => {
                toast.dismiss();
                toast.error(
                  `Error importing flags: ${error.message || 'Unknown error'}`,
                );
                console.error(error);
              });
          }
        } catch (parseError) {
          toast.error('Error parsing JSON file');
          console.error(parseError);
        }
      };
      reader.onerror = () => {
        toast.error('Error reading file');
      };
      reader.readAsText(file);
    }
  };

  const handleGenerateFlagOfTheDay = async () => {
    try {
      toast.loading('Generating flag of the day...');
      await generateFlagOfTheDay();
      toast.dismiss();
      toast.success('Flag of the day generated successfully');
      // Invalidate the flag of the day query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['flagOfTheDay'] });
    } catch (error) {
      toast.dismiss();
      toast.error('Error generating flag of the day');
      console.error(error);
    }
  };

  return (
    <div className='space-y-6'>
      <h2 className='text-[22px] font-semibold tracking-[-0.03em]'>Miscellaneous Actions</h2>

      <div className='grid gap-4 lg:grid-cols-2'>
        <div className='vx-tile p-5 space-y-3'>
          <h3 className='text-sm font-semibold'>Import Flags</h3>
          <p className='text-[13px] text-muted-foreground'>
            Upload a JSON file containing flag data to import into the database.
          </p>
          <Input
            className='w-full max-w-sm text-sm file:mr-3 file:text-foreground'
            type='file'
            accept='.json'
            onChange={handleImportFlags}
          />
        </div>

        <div className='vx-tile p-5 space-y-3'>
          <h3 className='text-sm font-semibold'>Generate Flag of the Day</h3>
          <p className='text-[13px] text-muted-foreground'>
            Manually generate a new flag of the day. This will replace the
            current flag of the day.
          </p>
          <Button onClick={handleGenerateFlagOfTheDay}>
            Generate Flag of the Day
          </Button>
        </div>
      </div>
    </div>
  );
}
