from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Record

from django.contrib import admin
from django.urls import path
from django.contrib.admin import AdminSite
from django.contrib import admin
from .models import Record

class RecordAdmin(admin.ModelAdmin):
    list_display = ('title', 'home_location', 'status', 'date_received')
    search_fields = ('title', 'home_location', 'status')
    list_filter = ('status', 'condition')

admin.site.register(Record, RecordAdmin)


class MyAdminSite(AdminSite):
    site_header = 'Collingham and District Local History Society Administration'
    site_title = 'Collingham Archive Admin'
    index_title = 'Welcome to the Collingham Archive Administration'

admin_site = MyAdminSite(name='myadmin')

# Register your models with the custom admin site
from .models import Record
admin_site.register(Record)

urlpatterns = [
    path('admin/', admin_site.urls),
]

