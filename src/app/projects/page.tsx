"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Edit3, FolderUp, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const folderPickerProps = {
  webkitdirectory: "",
  directory: "",
} as {
  webkitdirectory: string;
  directory: string;
};

interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  importStep: string | null;
  importProgress: number | null;
  errorMessage: string | null;
  chapterCount: number;
  totalConcepts: number;
  learnedConcepts: number;
  reviewDue: number;
  progress: number;
}

const emptyCreateForm = {
  name: "",
  slug: "",
  description: "",
};

const emptyEditForm = {
  name: "",
  description: "",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFolderName, setSelectedFolderName] = useState("");
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const fetchProjects = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: ProjectSummary[]) => {
        setProjects(data);
        const hasProcessing = data.some(
          (project) => project.status === "pending" || project.status === "processing"
        );

        if (hasProcessing && !pollingRef.current) {
          pollingRef.current = setInterval(() => fetchProjects(), 3000);
        } else if (!hasProcessing && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProjects();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.slug || selectedFiles.length === 0) return;

    setCreating(true);
    setCreateError(null);

    try {
      const uploadFormData = new FormData();
      for (const file of selectedFiles) {
        const relativePath =
          "webkitRelativePath" in file && typeof file.webkitRelativePath === "string"
            ? file.webkitRelativePath
            : file.name;
        uploadFormData.append("files", file);
        uploadFormData.append("paths", relativePath);
      }

      const uploadResponse = await fetch("/api/projects/upload-source", {
        method: "POST",
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const data = await uploadResponse.json().catch(() => null);
        setCreateError(data?.error || "선택한 폴더를 업로드하지 못했습니다.");
        return;
      }

      const uploadData = (await uploadResponse.json()) as { contentPath: string };
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          contentPath: uploadData.contentPath,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setCreateError(data?.error || "프로젝트를 생성하지 못했습니다.");
        return;
      }

      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      setSelectedFiles([]);
      setSelectedFolderName("");
      if (folderInputRef.current) folderInputRef.current.value = "";
      fetchProjects();
    } finally {
      setCreating(false);
    }
  };

  const handleFolderSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);

    const firstRelativePath =
      files[0] && "webkitRelativePath" in files[0]
        ? files[0].webkitRelativePath
        : "";
    const folderName = firstRelativePath ? firstRelativePath.split("/")[0] : "";
    setSelectedFolderName(folderName);
  };

  const openEditDialog = (project: ProjectSummary) => {
    setEditingProject(project);
    setEditForm({
      name: project.name,
      description: project.description ?? "",
    });
    setEditError(null);
  };

  const handleUpdate = async () => {
    if (!editingProject || !editForm.name.trim()) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/projects/${editingProject.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setEditError(data?.error || "프로젝트를 수정하지 못했습니다.");
        return;
      }

      setEditingProject(null);
      fetchProjects();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRetry = async (project: ProjectSummary) => {
    await fetch(`/api/projects/${project.slug}/retry`, {
      method: "POST",
    });
    fetchProjects();
  };

  const handleDelete = async (project: ProjectSummary) => {
    const confirmed = window.confirm(
      `"${project.name}" 프로젝트를 삭제할까요?\n관련 챕터와 학습 기록도 함께 삭제됩니다.`
    );
    if (!confirmed) return;

    setDeletingSlug(project.slug);

    try {
      const response = await fetch(`/api/projects/${project.slug}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        window.alert(data?.error || "프로젝트를 삭제하지 못했습니다.");
        return;
      }

      fetchProjects();
    } finally {
      setDeletingSlug(null);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-1 text-muted-foreground">학습 프로젝트 관리</p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) {
              setCreateError(null);
              setSelectedFiles([]);
              setSelectedFolderName("");
              if (folderInputRef.current) folderInputRef.current.value = "";
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>새 프로젝트</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 프로젝트 만들기</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">프로젝트 이름</Label>
                <Input
                  id="name"
                  placeholder="CS 면접 대비"
                  value={createForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name
                      .toLowerCase()
                      .replace(/[^a-z0-9가-힣]+/g, "-")
                      .replace(/^-|-$/g, "");
                    setCreateForm({ ...createForm, name, slug });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  placeholder="cs-interview"
                  value={createForm.slug}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, slug: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">설명 (선택)</Label>
                <Textarea
                  id="desc"
                  placeholder="프로젝트 설명"
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder-upload">학습 폴더 선택</Label>
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4">
                  <input
                    id="folder-upload"
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    {...folderPickerProps}
                    onChange={handleFolderSelection}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-2xl"
                    onClick={() => folderInputRef.current?.click()}
                  >
                    <FolderUp className="size-4" />
                    폴더 선택
                  </Button>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {selectedFiles.length > 0 ? (
                      <>
                        <span className="font-medium text-foreground">
                          {selectedFolderName || "선택한 폴더"}
                        </span>
                        <span> · {selectedFiles.length}개 파일 선택됨</span>
                      </>
                    ) : (
                      "마크다운 파일이 들어 있는 폴더를 통째로 선택하세요."
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Chromium 계열 브라우저에서 폴더 선택이 잘 동작합니다. 선택한
                    폴더는 서버에 업로드된 뒤 임포트됩니다.
                  </p>
                </div>
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <Button
                onClick={handleCreate}
                disabled={
                  creating ||
                  !createForm.name ||
                  !createForm.slug ||
                  selectedFiles.length === 0
                }
                className="w-full"
              >
                {creating ? "생성 중..." : "생성"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={!!editingProject}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProject(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로젝트 수정</DialogTitle>
            <DialogDescription>
              이름과 설명을 수정할 수 있습니다. `slug`와 콘텐츠 경로는 유지됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">프로젝트 이름</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">설명</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            {editingProject && (
              <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                slug: <span className="font-mono">{editingProject.slug}</span>
              </div>
            )}
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingProject(null);
                setEditError(null);
              }}
            >
              취소
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={savingEdit || !editForm.name.trim()}
            >
              {savingEdit ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            마크다운이 들어 있는 폴더를 선택해서 프로젝트를 생성하세요
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const isReady = project.status === "ready";
            const isProcessing =
              project.status === "pending" || project.status === "processing";
            const isFailed = project.status === "failed";
            const deleting = deletingSlug === project.slug;

            return (
              <Card
                key={project.id}
                className={`relative h-full gap-0 border-border/60 py-0 transition-colors ${
                  isReady ? "cursor-pointer hover:border-primary/50 hover:bg-muted/20" : ""
                }`}
                onClick={() => {
                  if (isReady) {
                    router.push(`/projects/${project.slug}`);
                  }
                }}
                role={isReady ? "link" : undefined}
                tabIndex={isReady ? 0 : undefined}
                onKeyDown={(e) => {
                  if (!isReady) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/projects/${project.slug}`);
                  }
                }}
              >
                <CardHeader className="gap-3 px-5 py-4">
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{project.name}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        /{project.slug}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full"
                          aria-label={`${project.name} 관리 메뉴`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(project);
                          }}
                        >
                          <Edit3 className="size-4" />
                          수정
                        </DropdownMenuItem>
                        {isFailed && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(project);
                            }}
                          >
                            <RotateCcw className="size-4" />
                            재시도
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project);
                          }}
                          disabled={isProcessing || deleting}
                        >
                          <Trash2 className="size-4" />
                          {deleting ? "삭제 중..." : "삭제"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isProcessing && <Badge variant="secondary">임포트 중</Badge>}
                    {isFailed && <Badge variant="destructive">실패</Badge>}
                    {isReady && project.reviewDue > 0 && (
                      <Badge variant="destructive">복습 {project.reviewDue}</Badge>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="relative z-10 space-y-3 border-t border-border/60 px-5 py-3">
                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {project.importStep || "준비 중..."}
                      </div>
                      <Progress value={(project.importProgress ?? 0) * 100} />
                      <div className="text-xs text-muted-foreground">
                        {Math.round((project.importProgress ?? 0) * 100)}%
                      </div>
                    </div>
                  )}

                  {isFailed && (
                    <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3">
                      <p className="text-sm text-red-700">
                        {project.errorMessage || "알 수 없는 오류"}
                      </p>
                    </div>
                  )}

                  {isReady && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>
                          {project.learnedConcepts}/{project.totalConcepts} 개념
                        </span>
                        <span>{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{project.chapterCount}개 챕터</span>
                        <span>카드 전체를 눌러 열기</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-1">
                    {isFailed ? (
                      <Button
                        variant="outline"
                        className="w-full rounded-2xl"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetry(project);
                        }}
                      >
                        <RotateCcw className="size-4" />
                        재시도
                      </Button>
                    ) : isProcessing ? (
                      <div className="text-xs text-muted-foreground">
                        임포트가 끝나면 프로젝트를 열 수 있습니다.
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        우상단 메뉴에서 수정과 삭제를 할 수 있습니다.
                      </div>
                    )}
                  </div>

                  {isProcessing && (
                    <p className="text-xs text-muted-foreground">
                      삭제는 관리 메뉴에서 확인할 수 있으며, 임포트 중에는 비활성화됩니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
