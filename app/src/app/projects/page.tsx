"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  chapterCount: number;
  totalConcepts: number;
  learnedConcepts: number;
  progress: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    contentPath: "",
  });

  const fetchProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.slug || !form.contentPath) return;
    setCreating(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ name: "", slug: "", description: "", contentPath: "" });
      fetchProjects();
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">학습 프로젝트 관리</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>새 프로젝트</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 프로젝트 만들기</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">프로젝트 이름</Label>
                <Input
                  id="name"
                  placeholder="CS 면접 대비"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name
                      .toLowerCase()
                      .replace(/[^a-z0-9가-힣]+/g, "-")
                      .replace(/^-|-$/g, "");
                    setForm({ ...form, name, slug });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  placeholder="cs-interview"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">설명 (선택)</Label>
                <Textarea
                  id="desc"
                  placeholder="프로젝트 설명"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="path">콘텐츠 경로</Label>
                <Input
                  id="path"
                  placeholder="cs-interview (content/ 하위 폴더명)"
                  value={form.contentPath}
                  onChange={(e) =>
                    setForm({ ...form, contentPath: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  content/ 디렉토리 하위의 폴더명을 입력하세요. MD 파일을 자동
                  임포트합니다.
                </p>
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || !form.name || !form.slug || !form.contentPath}
                className="w-full"
              >
                {creating ? "생성 중..." : "생성"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            content/ 폴더에 MD 파일을 넣고 프로젝트를 생성하세요
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.slug}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  {project.description && (
                    <p className="text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>
                        {project.learnedConcepts}/{project.totalConcepts} 개념
                      </span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} />
                    <div className="text-xs text-muted-foreground">
                      {project.chapterCount}개 챕터
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
