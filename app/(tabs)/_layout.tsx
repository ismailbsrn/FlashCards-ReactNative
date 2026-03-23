import { Tabs } from 'expo-router'
import React from 'react'

const _Layout = () => {
    return (
        <Tabs>
            <Tabs.Screen
                name='index'
                options={{
                    headerShown: false,
                    title: 'Home'
                }} />
            <Tabs.Screen
                name='collections'
                options={{
                    headerShown: false,
                    title: 'Collections'
                }} />
                <Tabs.Screen
                    name='profile'
                    options={{
                        headerShown: false,
                        title: 'Profile'
                    }} />
        </Tabs>
    )
}

export default _Layout