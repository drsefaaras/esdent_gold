import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function FollowUpManager({ refreshTrigger }) {
  const [followUps, setFollowUps] = useState([]);
  const [filteredFollowUps, setFilteredFollowUps] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ pending: 0, overdue: 0, completed: 0 });

  useEffect(() => {
    fetchFollowUps();
  }, [refreshTrigger]);

  useEffect(() => {
    filterFollowUps();
  }, [followUps, statusFilter]);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/followups`);
      setFollowUps(response.data);
      calculateStats(response.data);
    } catch (error) {
      console.error('Takipler yüklenirken hata:', error);
      toast.error('Takipler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const today = new Date().toISOString().split('T')[0];
    const pending = data.filter(f => f.status === 'beklemede' && f.followup_date >= today).length;
    const overdue = data.filter(f => f.status === 'beklemede' && f.followup_date < today).length;
    const completed = data.filter(f => f.status === 'tamamlandı').length;
    setStats({ pending, overdue, completed });
  };

  const filterFollowUps = () => {
    let filtered = followUps;
    const today = new Date().toISOString().split('T')[0];

    if (statusFilter === 'beklemede') {
      filtered = followUps.filter(f => f.status === 'beklemede' && f.followup_date >= today);
    } else if (statusFilter === 'geciken') {
      filtered = followUps.filter(f => f.status === 'beklemede' && f.followup_date < today);
    } else if (statusFilter === 'tamamlandi') {
      filtered = followUps.filter(f => f.status === 'tamamlandı');
    }

    setFilteredFollowUps(filtered);
  };

  const markAsCompleted = async (followupId) => {
    try {
      await axios.patch(`${API}/followups/${followupId}?status=tamamlandı`);
      toast.success('Takip tamamlandı olarak işaretlendi');
      fetchFollowUps();
    } catch (error) {
      console.error('Takip güncellenirken hata:', error);
      toast.error('Takip güncellenemedi');
    }
  };

  const getFollowUpStatus = (followup) => {
    const today = new Date().toISOString().split('T')[0];
    if (followup.status === 'tamamlandı') return 'tamamlandi';
    if (followup.followup_date < today) return 'geciken';
    return 'beklemede';
  };

  const getStatusBadge = (followup) => {
    const status = getFollowUpStatus(followup);
    switch (status) {
      case 'tamamlandi':
        return <Badge className="bg-green-600">Tamamlandı</Badge>;
      case 'geciken':
        return <Badge className="bg-red-600">Gecikmiş</Badge>;
      default:
        return <Badge className="bg-blue-600">Beklemede</Badge>;
    }
  };

  return (
    <div className="space-y-6" data-testid="followup-manager">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Beklemede</p>
                <p className="text-3xl font-bold text-blue-600" data-testid="stat-pending">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gecikmiş</p>
                <p className="text-3xl font-bold text-red-600" data-testid="stat-overdue">{stats.overdue}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tamamlandı</p>
                <p className="text-3xl font-bold text-green-600" data-testid="stat-completed">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Follow-ups List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Calendar className="w-5 h-5" />
              Takip Yönetimi
            </CardTitle>
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Durum filtrele" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="beklemede">Beklemede</SelectItem>
                  <SelectItem value="geciken">Gecikmiş</SelectItem>
                  <SelectItem value="tamamlandi">Tamamlandı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Takipler yükleniyor...</div>
          ) : filteredFollowUps.length === 0 ? (
            <div className="text-center py-8 text-gray-500" data-testid="no-followups-message">
              Takip bulunamadı
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead>Hasta Adı</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Doktor</TableHead>
                    <TableHead>Takip Tarihi</TableHead>
                    <TableHead>Neden</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFollowUps.map((followup, index) => (
                    <TableRow key={followup.id} data-testid={`followup-row-${index}`} className="hover:bg-blue-50">
                      <TableCell className="font-medium">{followup.patient_name}</TableCell>
                      <TableCell>{followup.phone_number || '-'}</TableCell>
                      <TableCell>{followup.doctor}</TableCell>
                      <TableCell>{followup.followup_date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-orange-100">{followup.reason}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(followup)}</TableCell>
                      <TableCell>
                        {followup.status === 'beklemede' && (
                          <Button
                            size="sm"
                            onClick={() => markAsCompleted(followup.id)}
                            className="bg-green-600 hover:bg-green-700"
                            data-testid={`btn-complete-${index}`}
                          >
                            Tamamlandı İşaretle
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}