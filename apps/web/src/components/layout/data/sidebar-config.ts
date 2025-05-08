'use client'


import { AudioWaveform, CogIcon, Command, ComputerIcon, CreditCardIcon, GalleryVerticalEnd, GroupIcon, LayoutIcon, ListTodoIcon, MessageSquareIcon, SettingsIcon, ShirtIcon } from 'lucide-react'
import { type SidebarData } from '../sidebar-types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Shadcn Admin',
      logo: Command,
      plan: 'Next.js + ShadcnUI',
    },
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: LayoutIcon,
        },
        {
          title: 'Tasks',
          url: '/tasks',
          icon: ListTodoIcon,
        },
        {
          title: 'Products',
          url: '/products',
          icon: ShirtIcon,
        },
        {
          title: 'Variants',
          url: '/variants',
          icon: ListTodoIcon,
        },
      ],
    },

    {
      title: 'Collapsible Routes',
      items: [
        {
          title: 'Settings',
          icon: SettingsIcon,
          items: [
            {
              title: 'Profile',
              url: '/settings/profile',
              icon: CogIcon,
            },
            {
              title: 'Workspace',
              url: '/settings/workspaces',
              icon: GroupIcon,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: MessageSquareIcon,
            },
            {
              title: 'Billing',
              url: '/settings/billing',
              icon: CreditCardIcon,
            },
            {
              title: 'System',
              url: '/settings/system',
              icon: ComputerIcon,
            },
          ],
        },
      ],
    },
  ],
}