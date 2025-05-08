import React from 'react'
import { useSearch } from '@/context/search-context'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    // CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-config'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowRightIcon } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'

export function CommandMenu() {
    const router = useRouter()
    const { open, setOpen } = useSearch()

    const runCommand = React.useCallback(
        (command: () => unknown) => {
            setOpen(false)
            command()
        },
        [setOpen]
    )

    return (
        <CommandDialog modal open={open} onOpenChange={setOpen}>
            <CommandInput placeholder='Type a command or search...' />
            <CommandList>
                <ScrollArea type='hover' className='h-72 pr-1'>
                    <CommandEmpty>No results found.</CommandEmpty>
                    {sidebarData.navGroups.map((group) => (
                        <CommandGroup key={group.title} heading={group.title}>
                            {group.items.map((navItem, i) => {
                                if (navItem.url)
                                    return (
                                        <CommandItem
                                            key={`${navItem.url}-${i}`}
                                            value={navItem.title}
                                            onSelect={() => {
                                                runCommand(() => router.navigate({ to: navItem.url }))
                                            }}
                                        >
                                            <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                                                <ArrowRightIcon className='size-2 text-muted-foreground/80' />
                                            </div>
                                            {navItem.title}
                                        </CommandItem>
                                    )

                                return navItem.items?.map((subItem, i) => (
                                    <CommandItem
                                        key={`${subItem.url}-${i}`}
                                        value={subItem.title}
                                        onSelect={() => {
                                            runCommand(() => router.navigate({ to: subItem.url }))
                                        }}
                                    >
                                        <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                                            <ArrowRightIcon className='size-2 text-muted-foreground/80' />
                                        </div>
                                        {subItem.title}
                                    </CommandItem>
                                ))
                            })}
                        </CommandGroup>
                    ))}
                </ScrollArea>
            </CommandList>
        </CommandDialog>
    )
}