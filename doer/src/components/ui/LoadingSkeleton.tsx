'use client'

import { Skeleton } from './Skeleton'
import { Card, CardContent, CardHeader } from './Card'

export const DashboardSkeleton = () => {
  return (
    <div className="space-y-8">
      {/* Welcome Section Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-6 w-80" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-12 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="col-span-12 md:col-span-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Dream States Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-64" />
                      <Skeleton className="h-4 w-96" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const MediaGallerySkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex space-x-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-16" />
          ))}
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i}>
            <CardContent className="p-0">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export const RoadmapSkeleton = () => {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <Skeleton className="w-5 h-5 rounded" />
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export const FileUploadSkeleton = () => {
  return (
    <div className="space-y-4">
      {/* Drop Zone Skeleton */}
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-8">
        <div className="flex flex-col items-center space-y-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2 text-center">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <Skeleton className="h-3 w-40 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}

