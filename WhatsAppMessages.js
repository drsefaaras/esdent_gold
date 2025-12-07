import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function WhatsAppMessages({ refreshTrigger }) {
  const [messages, setMessages] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [generatingDailySummary, setGeneratingDailySummary] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [refreshTrigger, selectedDate]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/whatsapp-messages`, {
        params: { date: selectedDate }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Mesajlar yüklenirken hata:', error);
      toast.error('Mesajlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const generateDailySummary = async () => {
    setGeneratingDailySummary(true);
    try {
      await axios.post(`${API}/generate-daily-summaries`, null, {
        params: { date: selectedDate }
      });
      toast.success('Günlük özetler başarıyla oluşturuldu!');
      fetchMessages();
    } catch (error) {
      console.error('Özetler oluşturulurken hata:', error);
      toast.error('Özetler oluşturulamadı');
    } finally {
      setGeneratingDailySummary(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Mesaj panoya kopyalandı!');
  };

  const approveAndSend = async (messageId, recipientName) => {
    try {
      await axios.patch(`${API}/whatsapp-messages/${messageId}/approve`);
      toast.success(`${recipientName} için mesaj onaylandı ve gönderildi olarak işaretlendi`);
      fetchMessages();
    } catch (error) {
      console.error('Mesaj onaylanırken hata:', error);
      toast.error('Mesaj onaylanamadı');
    }
  };

  const getMessageTypeBadge = (type) => {
    if (type === 'followup_reminder') {
      return <Badge className="bg-purple-600">Takip Hatırlatması</Badge>;
    }
    return <Badge className="bg-blue-600">Günlük Özet</Badge>;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'gönderildi':
        return <Badge className="bg-green-600">Gönderildi</Badge>;
      case 'başarısız':
        return <Badge className="bg-red-600">Başarısız</Badge>;
      default:
        return <Badge className="bg-yellow-600">Onay Bekliyor</Badge>;
    }
  };

  const pendingMessages = messages.filter(m => m.status === 'onay_bekliyor');
  const sentMessages = messages.filter(m => m.status === 'gönderildi');

  return (
    <div className="space-y-6" data-testid="whatsapp-messages">
      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <MessageSquare className="w-5 h-5" />
              WhatsApp Mesajları
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="w-48">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <Button
                onClick={generateDailySummary}
                disabled={generatingDailySummary}
                className="bg-green-600 hover:bg-green-700"
              >
                {generatingDailySummary ? 'Oluşturuluyor...' : 'Günlük Özet Oluştur'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
            <p className="text-sm text-blue-900">
              <strong>Not:</strong> Mesajlar otomatik olarak oluşturulur. WhatsApp üzerinden manuel olarak kopyalayıp gönderin, ardından "Onayla ve Gönder" butonuna tıklayın.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pending Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-orange-700">Onay Bekleyen Mesajlar ({pendingMessages.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Mesajlar yükleniyor...</div>
          ) : pendingMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Bu tarih için bekleyen mesaj yok
            </div>
          ) : (
            pendingMessages.map((message) => (
              <Card key={message.id} className="border-2 border-yellow-200 bg-yellow-50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-lg">{message.recipient_name}</p>
                        <p className="text-sm text-gray-600">{message.recipient_phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getMessageTypeBadge(message.message_type)}
                        {getStatusBadge(message.status)}
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                      <pre className="whitespace-pre-wrap font-sans text-sm">{message.message_text}</pre>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => copyToClipboard(message.message_text)}
                        variant="outline"
                        className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Mesajı Kopyala
                      </Button>
                      <Button
                        onClick={() => approveAndSend(message.id, message.recipient_name)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Onayla ve Gönder
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Sent Messages */}
      {sentMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Gönderilen Mesajlar ({sentMessages.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sentMessages.map((message) => (
              <Card key={message.id} className="border-2 border-green-200 bg-green-50 opacity-75">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{message.recipient_name}</p>
                      <p className="text-sm text-gray-600">{message.recipient_phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getMessageTypeBadge(message.message_type)}
                      {getStatusBadge(message.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}