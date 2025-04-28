import * as React from "react"
import { BookDashedIcon, CameraIcon, DatabaseIcon, FileIcon, HelpCircleIcon, ReceiptEuroIcon, SearchIcon, SettingsIcon, ShapesIcon } from "lucide-react"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar"
import { AppSidebarMain } from "./app-sidebar-main"
import { AppSidebarSecondary } from "./app-sidebar-secondary"
import { AppSidebarUser } from "./app-sidebar-user"
import { AppSidebarCollapsibleGroup } from "./app-sidebar-collapsible-group"
import { sidebarData } from "./data/sidebar-config"
import { Link } from "@tanstack/react-router"

const data = {
    user: {
        name: "shadcn",
        email: "m@example.com",
        avatar: "/avatars/shadcn.jpg",
    },
    navMain: [
        {
            title: "Dashboard",
            url: "#",
            icon: BookDashedIcon,
        },

    ],
    navClouds: [
        {
            title: "Capture",
            icon: CameraIcon,
            isActive: true,
            url: "#",
            items: [
                {
                    title: "Active Proposals",
                    url: "#",
                },
                {
                    title: "Archived",
                    url: "#",
                },
            ],
        },
        {
            title: "Proposal",
            icon: FileIcon,
            url: "#",
            items: [
                {
                    title: "Active Proposals",
                    url: "#",
                },
                {
                    title: "Archived",
                    url: "#",
                },
            ],
        },

    ],
    navSecondary: [
        {
            title: "Settings",
            url: "#",
            icon: SettingsIcon,
        },
        {
            title: "Get Help",
            url: "#",
            icon: HelpCircleIcon,
        },
        {
            title: "Search",
            url: "#",
            icon: SearchIcon,
        },
    ],
    documents: [
        {
            name: "Data Library",
            url: "#",
            icon: DatabaseIcon,
        },
        {
            name: "Reports",
            url: "#",
            icon: ReceiptEuroIcon,
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible='icon' {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                        >
                            <Link to='/profile'>
                                <ShapesIcon className="!size-5" />
                                <span className="text-base font-semibold">CHANGE_MA_LINK</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <AppSidebarMain items={data.navMain} />
                {sidebarData.navGroups.map((props) => (
                    <AppSidebarCollapsibleGroup key={props.title} {...props} />
                ))}
                <AppSidebarSecondary items={data.navSecondary} className="mt-auto" />
            </SidebarContent>
            <SidebarFooter>
                <AppSidebarUser user={data.user} />
            </SidebarFooter>
        </Sidebar>
    )
}